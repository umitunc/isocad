#!/usr/bin/env python3
"""
Piping Isometric Drawing Data Extractor - v2
============================================
Düzeltmeler:
  1. MTO: word-position + sayfa genişliği oranı ile doğru sütun ayrımı
     DAN code iki satıra bölünme sorunu çözüldü
  2. Weld Log: çizimdeki daireli rakamlar = weld joint numaraları
     Sekans: NS/Cont → <pipe1> → weld → fitting → weld → <pipe2> → ...
  3. 3D/4D BEND RADIUS: MTO'da boru, kaynak yok
  4. Line No: başlık bloğundan doğru çekildi
  5. Sheet No, Rev No: sayfadan doğru okunuyor
"""

import os, re, sys, glob
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List, Dict

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ── DN → INCH ──────────────────────────────────────────────
DN_TO_INCH: Dict[int, str] = {
    15:'1/2"', 20:'3/4"', 25:'1"', 32:'1-1/4"', 40:'1-1/2"',
    50:'2"', 65:'2-1/2"', 80:'3"', 100:'4"', 125:'5"',
    150:'6"', 200:'8"', 250:'10"', 300:'12"', 350:'14"',
    400:'16"', 450:'18"', 500:'20"', 600:'24"',
}

COMP_KEYWORDS = {
    'PIPE':     ['PIPE', 'ТРУБА'],
    'FLANGES':  ['FLANGE', 'ФЛАНЕЦ'],
    'GASKETS':  ['GASKET', 'ПРОКЛАДКА'],
    'VALVES':   ['VALVE', 'GATE', 'GLOBE', 'BALL', 'BUTTERFLY', 'CHECK',
                 'КЛАПАН', 'ЗАДВИЖКА'],
    'FITTINGS': ['ELBOW', 'TEE', 'REDUCER', 'COUPLING', 'CAP', 'NIPPLE',
                 'WELDOLET', 'SOCKOLET', 'КОЛЕНО', 'ТРОЙНИК', 'ПЕРЕХОД',
                 'МУФТА', 'ЗАГЛУШКА'],
    'SUPPORTS': ['SUPPORT', 'HANGER', 'U-BOLT', 'REST', 'GUIDE',
                 'SPRING', 'HOLD', 'ОПОРА'],
}

# ── DATA CLASSES ────────────────────────────────────────────
@dataclass
class MTOItem:
    line_no:str=''; rev_no:str=''; sheet_no:str=''
    item_no:str=''; component:str=''; description:str=''
    size_dn:str=''; dan_code:str=''; qty:str=''
    unit:str=''; weight:str=''

@dataclass
class CutItem:
    line_no:str=''; sheet_no:str=''; piece_no:str=''
    length:str=''; size_dn:str=''; end_prep:str=''; remarks:str=''

@dataclass
class SupportItem:
    line_no:str=''; rev_no:str=''; sheet_no:str=''
    support_ref:str=''; support_type:str=''
    size_dn:str=''; quantity:str=''

@dataclass
class WeldJoint:
    line_no:str=''; joint_no:int=0; rev_no:str=''; sheet_no:str=''
    item1:str=''; desc1:str=''; dan_code1:str=''
    size1_dn:str=''; size1_mm:str=''; size1_inch:str=''; thk1_mm:str=''
    item2:str=''; desc2:str=''; dan_code2:str=''
    size2_dn:str=''; size2_mm:str=''; size2_inch:str=''; thk2_mm:str=''

# ── HELPERS ─────────────────────────────────────────────────
def dn_to_inch(dn_str:str) -> str:
    try:
        dn = int(float(str(dn_str).split('x')[0].strip()))
        return DN_TO_INCH.get(dn, f'{round(dn/25.4,2)}"')
    except: return dn_str or ''

def parse_dn(s:str) -> str:
    if not s: return ''
    m = re.match(r'(\d+)', str(s).strip())
    return m.group(1) if m else str(s).strip()

def parse_thk(desc:str) -> str:
    m = re.search(r'[Tt]hk\.?(\d+[.,]\d+)\s*mm', desc)
    return m.group(1).replace(',','.') if m else ''

def dn_val(s:str) -> int:
    try: return int(float(str(s).split('x')[0].split('X')[0].strip()))
    except: return 0

def normalize_dan(parts:List[str]) -> str:
    combined = ''.join(parts).replace(' ','')
    combined = re.sub(r'-+','-',combined).rstrip('-')
    if re.match(r'^\d{3}-\d{3}-\d{3}-\d{3}$', combined):
        return combined
    digits = combined.replace('-','')
    if len(digits) == 12 and digits.isdigit():
        return f'{digits[0:3]}-{digits[3:6]}-{digits[6:9]}-{digits[9:12]}'
    m = re.match(r'(\d{3}-\d{3}-\d{3})-?(\d{1,3})?$', combined)
    if m:
        return f'{m.group(1)}-{(m.group(2) or "").zfill(3)}'
    return combined or '-'

def classify_comp(desc:str) -> str:
    up = desc.upper()
    for comp, kws in COMP_KEYWORDS.items():
        if any(k in up for k in kws): return comp
    return 'FITTINGS'

def detect_sup_type(desc:str) -> str:
    u = desc.upper()
    if 'SPRING' in u: return 'Spring'
    if 'GUIDE' in u: return 'Guide'
    if 'HOLD' in u or 'AXIAL' in u: return 'Hold-Down'
    if 'REST' in u: return 'Rest'
    if 'U-BOLT' in u: return 'U-Bolt'
    if 'HANGER' in u: return 'Hanger'
    return 'Rigid'

def group_rows(words:list, tol:float=4) -> List:
    if not words: return []
    sw = sorted(words, key=lambda w: w['top'])
    rows, cy, cr = [], sw[0]['top'], []
    for w in sw:
        if abs(w['top'] - cy) <= tol: cr.append(w)
        else:
            rows.append((cy, sorted(cr, key=lambda x: x['x0'])))
            cr, cy = [w], w['top']
    if cr: rows.append((cy, sorted(cr, key=lambda x: x['x0'])))
    return rows

# ── MTO PARSER (word-position based) ────────────────────────
class MTOWordParser:
    """
    Gerçek sütun konumları (2384pt genişlik):
      ITEM    x≈1719  → page_w * 0.721
      DESC    x≈1750  → page_w * 0.734 .. 0.852
      SIZE    x≈2034  → page_w * 0.853 .. 0.883
      DAN     x≈2106  → page_w * 0.884 .. 0.923
      QTY     x≈2201  → page_w * 0.924 .. 0.950
      WEIGHT  x≈2267  → page_w * 0.951 .. 1.000
    """
    # (low, high) — x0/page_width
    COLS = {
        'item':   (0.715, 0.733),
        'desc':   (0.733, 0.852),
        'size':   (0.852, 0.883),
        'dan':    (0.883, 0.921),
        'qty':    (0.921, 0.952),
        'weight': (0.952, 1.000),
    }

    def parse(self, page, line_no:str, rev_no:str, sheet_no:str) -> List[MTOItem]:
        words = page.extract_words()
        pw = page.width
        mto_words = [w for w in words if w['x0'] >= pw * 0.68]
        if not mto_words: return []

        rows = group_rows(mto_words, tol=4)
        items: List[MTOItem] = []
        in_fab = in_erect = False
        cur_sec = ''
        cur = None

        def flush():
            nonlocal cur
            if cur:
                it = self._build(cur, cur_sec, line_no, rev_no, sheet_no, pw)
                if it: items.append(it)
            cur = None

        for _, rw in rows:
            text = ' '.join(w['text'] for w in rw).strip()
            # skip header rows
            if re.match(r'^(ITEM|COMPONENT|DESCRIPTION|SIZE|DAN|CODE|QTY|WEIGHT|\(DN\)|\(Kg\))', text): continue
            # section triggers
            if re.match(r'^FABRICATION\s+MATERIALS', text, re.I):
                flush(); in_fab=True; in_erect=False; continue
            if re.match(r'^ERECTION\s+MATERIALS', text, re.I):
                flush(); in_erect=True; in_fab=False; continue
            if not in_fab and not in_erect: continue
            if re.match(r'^TOTAL\s+(FABRICATION|ERECTION|WEIGHT)', text, re.I):
                flush()
                if 'TOTAL WEIGHT' in text.upper(): in_fab=in_erect=False
                continue
            sm = re.match(
                r'^(PIPE|FITTINGS|FLANGES|GASKETS|'
                r'VALVES(?:\s*/\s*IN-LINE\s+ITEMS)?|'
                r'SUPPORTS|INSTRUMENTS|BOLTS)$', text, re.I)
            if sm:
                flush(); cur_sec = sm.group(1).upper()
                if 'VALVES' in cur_sec or 'IN-LINE' in cur_sec: cur_sec='VALVES'
                continue

            # column split
            c = self._cols(rw, pw)
            item_t = c['item'].strip()
            desc_t = c['desc'].strip()
            size_t = c['size'].strip()
            dan_t  = c['dan'].strip()
            qty_t  = c['qty'].strip()
            wt_t   = c['weight'].strip()

            # DAN continuation: only digits at DAN column position → append to prev
            if dan_t and re.match(r'^\d{1,4}$', dan_t) and cur and not item_t:
                cur['dan_raw'].append(dan_t)
                if desc_t: cur['desc_parts'].append(desc_t)
                continue

            # New item line
            if re.match(r'^\d{1,2}$', item_t) and desc_t:
                flush()
                cur = {
                    'item_no':    item_t,
                    'desc_parts': [desc_t],
                    'size':       size_t,
                    'dan_raw':    [dan_t] if dan_t else [],
                    'qty':        qty_t,
                    'weight':     wt_t,
                }
            elif cur and (desc_t or dan_t):
                # continuation line
                if desc_t: cur['desc_parts'].append(desc_t)
                if dan_t:  cur['dan_raw'].append(dan_t)
                if not cur['qty'] and qty_t: cur['qty'] = qty_t
                if not cur['weight'] and wt_t: cur['weight'] = wt_t
                if not cur['size'] and size_t: cur['size'] = size_t

        flush()
        return items

    def _cols(self, rw:list, pw:float) -> dict:
        c = {k:'' for k in self.COLS}
        for w in rw:
            rel = w['x0'] / pw
            for cn,(lo,hi) in self.COLS.items():
                if lo <= rel < hi:
                    c[cn] = (c[cn]+' '+w['text']).strip(); break
            else:
                # fallback to nearest col
                best = min(self.COLS, key=lambda k: abs(rel-(self.COLS[k][0]+self.COLS[k][1])/2))
                c[best] = (c[best]+' '+w['text']).strip()
        return c

    def _build(self, d:dict, sec:str, line_no, rev_no, sheet_no, pw) -> Optional[MTOItem]:
        if not d or not d.get('item_no'): return None
        desc = re.sub(r'\s+',' ',' '.join(d['desc_parts'])).strip()
        if not desc or desc.upper() in ('PIPE','FITTINGS','FLANGES','GASKETS','VALVES','SUPPORTS','BOLTS'):
            return None

        # DAN code — birleştir
        # Örnek: ['000-000-089-', '574'] → '000-000-089-574'
        dan = normalize_dan(d.get('dan_raw', []))

        # Size
        sz_raw = d.get('size','').strip()
        # "200 x 25" → "200"   or   "200" → "200"
        size_dn = parse_dn(sz_raw)

        # QTY / WEIGHT — son iki sayısal token olabilir; ham al
        qty = d.get('qty','').strip()
        wt  = d.get('weight','').strip()

        # Qty ve weight bazen weight sütununda "N wt" şeklinde gelir
        # Örn weight='000-000-089- 46.4M 1357.21'
        # → bu zaten normalize_dan tarafından DAN'a alındı, qty/wt temiz olmalı
        # Ama yine de düzelt:
        if not qty and wt:
            parts = wt.split()
            if len(parts) >= 2:
                qty = parts[-2]
                wt  = parts[-1]

        comp = sec if sec else classify_comp(desc)
        unit = 'M' if comp == 'PIPE' else 'ADT'
        return MTOItem(
            line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
            item_no=d['item_no'], component=comp,
            description=desc[:120],
            size_dn=size_dn, dan_code=dan,
            qty=qty, unit=unit, weight=wt,
        )


# ── CUT LIST PARSER ─────────────────────────────────────────
class CutListParser:
    def parse(self, page, line_no:str, sheet_no:str) -> List[CutItem]:
        words = page.extract_words()
        pw = page.width
        mto_words = [w for w in words if w['x0'] >= pw * 0.68]
        rows = group_rows(mto_words, tol=4)
        items: List[CutItem] = []
        in_cut = False
        seen: set = set()

        for _, rw in rows:
            text = ' '.join(w['text'] for w in rw).strip()
            if re.search(r'CUT\s+PIPE\s+LENGTH', text, re.I):
                in_cut = True; continue
            if not in_cut: continue
            if re.match(r'^(PIECE|CUT|SIZE|REMARKS|END|NO|LENGTH|DN|PREP)', text, re.I): continue

            # <N> length size [remarks] end_prep
            m = re.match(
                r'(<\d+>)\s+(\d+)\s+(\d{2,4})'
                r'(?:\s+(PLD\s*BEND))?'
                r'(?:\s+(BE/BE|BE/PE|PE/PE|PE/BE|PLD\s*BEND\s*PE/PE|[A-Z]+/[A-Z]+))?',
                text.strip(), re.I)
            if m:
                piece_no = m.group(1)
                length   = m.group(2)
                size     = m.group(3)
                remarks  = (m.group(4) or '').strip()
                end_prep = (m.group(5) or '').strip()
                key = (piece_no, size)
                if key not in seen:
                    seen.add(key)
                    items.append(CutItem(
                        line_no=line_no, sheet_no=sheet_no,
                        piece_no=piece_no, length=length,
                        size_dn=size, end_prep=end_prep, remarks=remarks,
                    ))
        return items


# ── SUPPORT PARSER ───────────────────────────────────────────
class SupportParser:
    FA_REF = re.compile(r'\b(FA\d{2}-[A-Z]-\d+(?:[./]\d+)?)\b', re.I)

    def parse(self, full_text:str, mto_items:List[MTOItem],
              line_no:str, rev_no:str, sheet_no:str) -> List[SupportItem]:
        items:List[SupportItem] = []
        seen:set = set()

        # MTO'daki destek satırları
        for m in mto_items:
            if m.component == 'SUPPORTS':
                try: qty = int(float(re.sub(r'[MmFt]','',m.qty) or '1'))
                except: qty = 1
                ref = f'SUP-{m.item_no}'
                if ref not in seen:
                    seen.add(ref)
                    items.append(SupportItem(
                        line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                        support_ref=ref,
                        support_type=detect_sup_type(m.description),
                        size_dn=m.size_dn, quantity=str(qty),
                    ))

        # Çizimden FA00-S-xxx referansları
        for mm in self.FA_REF.finditer(full_text):
            ref = mm.group(1).upper()
            if ref not in seen:
                seen.add(ref)
                items.append(SupportItem(
                    line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                    support_ref=ref, support_type='Rigid',
                    size_dn='', quantity='1',
                ))
        return items


# ── WELD LOG GENERATOR ───────────────────────────────────────
class WeldLogGenerator:
    """
    Piping isometric sekans mantığı:

    Çizim boyunca her boru parçası (<N>) ile fittinglerin arasında
    kaynak noktaları (daireli rakam) bulunur.

    Sekans yeniden inşası:
      1. Ana hat (büyük DN) boru parçaları → <1>, <2>, ...<N> (cut list'ten)
      2. Fitting sayıları MTO'dan alınır (90° elbow x9, 45° elbow x3, vs.)
      3. Fitting'ler boru parçaları ARASINA yerleştirilir
      4. Her komponent çifti arasında 1 kaynak noktası

    Her sayfada:
      - FAB: Ana hat boruları + büyük DN fitting'ler  → ana hat weld'leri
      - ERECT: Küçük DN borular (drain/vent dalları) → dal weld'leri
    """

    def generate(self, page_text:str, mto_items:List[MTOItem],
                 cut_items:List[CutItem],
                 line_no:str, rev_no:str, sheet_no:str,
                 start_joint_no:int=1) -> List[WeldJoint]:

        joints:List[WeldJoint] = []

        pipe_items    = [m for m in mto_items if m.component=='PIPE']
        fitting_items = [m for m in mto_items if m.component=='FITTINGS']
        valve_items   = [m for m in mto_items if m.component=='VALVES']

        if not pipe_items: return joints

        # Ana hat = en büyük DN
        main_dn_val = max(dn_val(p.size_dn) for p in pipe_items)
        main_pipes  = [p for p in pipe_items if dn_val(p.size_dn)==main_dn_val]
        branch_pipes= [p for p in pipe_items if dn_val(p.size_dn)<main_dn_val]

        main_cuts = sorted(
            [c for c in cut_items if dn_val(c.size_dn)==main_dn_val],
            key=lambda c: int(re.sub(r'[<>]','',c.piece_no))
        )

        # Ana hat fitting'leri — büyük DN
        main_fittings = [f for f in fitting_items
                         if dn_val(f.size_dn)==main_dn_val]

        # 3D/4D BEND RADIUS: Bu ifadeler boru büküm notudur;
        # ayrı fitting değil — boru parçası olarak kalır, araya kaynak girmez.
        # Fitting havuzu sadece gerçek fittingleri içerir.
        fitting_pool = self._expand_fittings(main_fittings)

        # 45° pozisyonlarını tespit et
        elbow45_cuts = self._find_45_positions(page_text, main_cuts)

        # Weld sekansı oluştur
        jno = start_joint_no
        jno = self._main_welds(
            joints, main_pipes, main_cuts, fitting_pool,
            elbow45_cuts, line_no, rev_no, sheet_no, jno)

        # Dal weld'leri (drain/vent)
        jno = self._branch_welds(
            joints, branch_pipes, fitting_items, valve_items,
            line_no, rev_no, sheet_no, jno)

        return joints

    def _expand_fittings(self, fittings:List[MTOItem]) -> list:
        pool = []
        for f in fittings:
            try: cnt = max(1, int(float(re.sub(r'[MmFtADT]','',f.qty) or '1')))
            except: cnt = 1
            for _ in range(cnt):
                pool.append({
                    'item_no': f.item_no,
                    'desc':    f.description,
                    'dan':     f.dan_code,
                    'size_dn': f.size_dn,
                    'thk':     parse_thk(f.description),
                    'is45':    '45' in f.description,
                    'is90':    '90' in f.description,
                })
        return pool

    def _find_45_positions(self, text:str, cuts:List[CutItem]) -> set:
        """45° elbow olan boru parçası numaralarını bul."""
        positions = set()
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if re.search(r'45[o°]', line, re.I):
                ctx = '\n'.join(lines[max(0,i-3):i+4])
                for mm in re.finditer(r'<(\d+)>', ctx):
                    positions.add(int(mm.group(1)))
        return positions

    def _pipe_node(self, pipe_mto:MTOItem, cut:Optional[CutItem]=None) -> dict:
        return {
            'item_no': pipe_mto.item_no,
            'desc':    pipe_mto.description,
            'dan':     pipe_mto.dan_code,
            'size_dn': pipe_mto.size_dn,
            'thk':     parse_thk(pipe_mto.description),
            'piece':   cut.piece_no if cut else '',
        }

    def _cont_node(self, size_dn:str, thk:str) -> dict:
        return {
            'item_no':'-', 'desc':'Continuation/Nozzle',
            'dan':'-', 'size_dn':size_dn, 'thk':thk,
        }

    def _main_welds(self, joints:list, pipes:list, cuts:list,
                    pool:list, elbow45:set,
                    line_no, rev_no, sheet_no, jno:int) -> int:
        if not pipes or not cuts: return jno
        ref_pipe = pipes[0]
        cont = self._cont_node(ref_pipe.size_dn, parse_thk(ref_pipe.description))

        # pool'u 45/90/diğer olarak böl
        p45    = [f for f in pool if f['is45']]
        p90    = [f for f in pool if f['is90'] and not f['is45']]
        p_rest = [f for f in pool if not f['is45'] and not f['is90']]

        seq = [cont]
        for i, cut in enumerate(cuts):
            seq.append(self._pipe_node(ref_pipe, cut))
            if i < len(cuts)-1:
                cn = int(re.sub(r'[<>]','',cut.piece_no))
                if cn in elbow45 and p45:   seq.append(p45.pop(0))
                elif p90:                   seq.append(p90.pop(0))
                elif p_rest:                seq.append(p_rest.pop(0))
                # else: doğrudan boru-boru birleşimi (uzun çizgilerde)
        seq.append(cont)

        for i in range(len(seq)-1):
            jno = self._add_joint(joints, seq[i], seq[i+1],
                                  line_no, rev_no, sheet_no, jno)
        return jno

    def _branch_welds(self, joints:list,
                      branch_pipes:list, fittings:list, valves:list,
                      line_no, rev_no, sheet_no, jno:int) -> int:
        for bp in branch_pipes:
            bdv = dn_val(bp.size_dn)
            b_fits  = [f for f in fittings  if dn_val(f.size_dn)==bdv]
            b_valves= [v for v in valves     if dn_val(v.size_dn)==bdv]

            # Junction fitting (coupling, tee) → valve → nipple/cap
            seq = []
            junction = next((f for f in fittings
                             if re.search(r'COUPLING|TEE|SOCKOLET|WELDOLET',
                                         f.description, re.I)
                             and bdv in [dn_val(f.size_dn)]), None)
            if junction:
                seq.append({'item_no':junction.item_no,'desc':junction.description,
                            'dan':junction.dan_code,'size_dn':junction.size_dn,
                            'thk':parse_thk(junction.description)})
            seq.append({'item_no':bp.item_no,'desc':bp.description,
                        'dan':bp.dan_code,'size_dn':bp.size_dn,
                        'thk':parse_thk(bp.description)})
            for v in b_valves[:1]:
                seq.append({'item_no':v.item_no,'desc':v.description,
                            'dan':v.dan_code,'size_dn':v.size_dn,
                            'thk':parse_thk(v.description)})
            nipple = next((f for f in b_fits
                           if re.search(r'NIPPLE|CAP',f.description,re.I)), None)
            if nipple:
                seq.append({'item_no':nipple.item_no,'desc':nipple.description,
                            'dan':nipple.dan_code,'size_dn':nipple.size_dn,
                            'thk':parse_thk(nipple.description)})

            for i in range(len(seq)-1):
                jno = self._add_joint(joints, seq[i], seq[i+1],
                                      line_no, rev_no, sheet_no, jno)
        return jno

    def _add_joint(self, joints:list, left:dict, right:dict,
                   line_no, rev_no, sheet_no, jno:int) -> int:
        joints.append(WeldJoint(
            line_no=line_no, joint_no=jno, rev_no=rev_no, sheet_no=sheet_no,
            item1=left.get('item_no',''),
            desc1=left.get('desc','')[:60],
            dan_code1=left.get('dan',''),
            size1_dn=left.get('size_dn',''),
            size1_mm=left.get('size_dn',''),
            size1_inch=dn_to_inch(left.get('size_dn','')),
            thk1_mm=left.get('thk',''),
            item2=right.get('item_no',''),
            desc2=right.get('desc','')[:60],
            dan_code2=right.get('dan',''),
            size2_dn=right.get('size_dn',''),
            size2_mm=right.get('size_dn',''),
            size2_inch=dn_to_inch(right.get('size_dn','')),
            thk2_mm=right.get('thk',''),
        ))
        return jno + 1


# ── PAGE META ────────────────────────────────────────────────
class PageMeta:
    def __init__(self, page, page_num:int):
        self.page_num = page_num
        self.words    = page.extract_words()
        self.pw       = page.width
        self.ph       = page.height
        self.text     = page.extract_text() or ''
        self.line_no  = self._line_no()
        self.rev_no   = self._rev_no()
        self.sheet_no = str(page_num)

    def _line_no(self) -> str:
        # Başlık bloğu: sayfa altı 15% + sağ 40%
        bot_y = self.ph * 0.85
        bot_words = [w for w in self.words
                     if w['top'] >= bot_y and w['x0'] >= self.pw * 0.60]
        for w in sorted(bot_words, key=lambda x: x['top']):
            t = w['text']
            # QWR-200-AH01JL-FA00.002-PP stilinde çizim adı
            if re.match(r'^[A-Z]{2,6}-\d{2,4}-[A-Z0-9]+-[A-Z0-9]+[.\-][0-9]{3}', t, re.I):
                return t.strip()
        m = re.search(r'LINE[:\s]+([A-Z0-9]{2,6}-\d{2,4}-[A-Z0-9\-\.]+)',
                      self.text, re.I)
        if m: return m.group(1).strip()
        return ''

    def _rev_no(self) -> str:
        ms = re.findall(r'^(\d{2}[A-Z]?)\s+\d{1,2}\s+\w{3,4}\s+\d{4}',
                        self.text, re.M)
        if ms: return ms[-1]
        m = re.search(r'\b(\d{2}[A-Z]?)\s+\d{1,2}\s+\w+\s+\d{4}', self.text)
        if m: return m.group(1)
        return '00'


# ── MAIN EXTRACTOR ───────────────────────────────────────────
class PipingDataExtractor:
    def __init__(self, pdf_folder:str):
        self.pdf_folder = pdf_folder
        self.mto_p   = MTOWordParser()
        self.cut_p   = CutListParser()
        self.sup_p   = SupportParser()
        self.weld_g  = WeldLogGenerator()
        self.all_mto:      List[MTOItem]     = []
        self.all_cuts:     List[CutItem]     = []
        self.all_supports: List[SupportItem] = []
        self.all_welds:    List[WeldJoint]   = []

    def process_all(self):
        pdfs = sorted(glob.glob(os.path.join(self.pdf_folder, '*.pdf')))
        if not pdfs:
            print(f'⚠  PDF bulunamadı: {self.pdf_folder}'); return
        print(f'\n{"="*60}\n  {len(pdfs)} PDF işleniyor\n{"="*60}')
        for p in pdfs: self._process(p)
        print(f'\n{"="*60}')
        print(f'  MTO      : {len(self.all_mto)} satır')
        print(f'  Cut List : {len(self.all_cuts)} parça')
        print(f'  Supports : {len(self.all_supports)} adet')
        print(f'  Weld Log : {len(self.all_welds)} kaynak')
        print(f'{"="*60}\n')

    def _process(self, pdf_path:str):
        fname = Path(pdf_path).name
        print(f'\n  📄 {fname}')
        try:
            with pdfplumber.open(pdf_path) as pdf:
                pages = []
                for i, p in enumerate(pdf.pages):
                    if (p.extract_text() or '').strip():
                        pages.append((PageMeta(p, i+1), p))
                if not pages: print('     ⚠  Metin yok'); return

                # Line No
                line_no = pages[0][0].line_no
                if not line_no:
                    stem = Path(pdf_path).stem
                    line_no = re.sub(r'_', '.', stem)
                    line_no = re.sub(r'\.\.', '.', line_no)
                print(f'     📋 Line No: {line_no}')

                all_mto:  List[MTOItem]  = []
                all_cuts: List[CutItem]  = []
                full_text = ''

                for meta, pobj in pages:
                    meta.line_no = line_no
                    # MTO
                    mto = self.mto_p.parse(pobj, line_no, meta.rev_no, meta.sheet_no)
                    all_mto.extend(mto)
                    if mto: print(f'       ✅ Sayfa {meta.sheet_no} MTO: {len(mto)} satır')
                    # Cut
                    cuts = self.cut_p.parse(pobj, line_no, meta.sheet_no)
                    all_cuts.extend(cuts)
                    if cuts: print(f'       ✅ Sayfa {meta.sheet_no} Cut: {len(cuts)} parça')
                    full_text += '\n' + meta.text

                # Tekilleştir (aynı sheet+item)
                seen: set = set()
                dedup: List[MTOItem] = []
                for it in all_mto:
                    k = (it.sheet_no, it.item_no)
                    if k not in seen: seen.add(k); dedup.append(it)

                # Supports
                rev_no = pages[0][0].rev_no
                sups = self.sup_p.parse(full_text, dedup, line_no, rev_no, '1')
                print(f'       ✅ Destek: {len(sups)} adet')

                # Weld log — sayfa bazlı, devam eden numara
                gjno = len(self.all_welds) + 1
                for meta, pobj in pages:
                    pm = [m for m in dedup   if m.sheet_no == meta.sheet_no]
                    pc = [c for c in all_cuts if c.sheet_no == meta.sheet_no]
                    if not pm: continue
                    wj = self.weld_g.generate(
                        meta.text, pm, pc, line_no, meta.rev_no, meta.sheet_no, gjno)
                    if wj:
                        print(f'       ✅ Sayfa {meta.sheet_no} Weld: {len(wj)} kaynak')
                        gjno += len(wj)
                    self.all_welds.extend(wj)

                self.all_mto.extend(dedup)
                self.all_cuts.extend(all_cuts)
                self.all_supports.extend(sups)

        except Exception as e:
            print(f'     ❌ Hata: {e}')
            import traceback; traceback.print_exc()


# ── EXCEL WRITER ─────────────────────────────────────────────
class ExcelWriter:
    NAVY='FF1F3864'; BLUE='FF2E75B6'; GREEN='FF375623'
    BROWN='FF7B2D00'; TEAL='FF006B6B'; WHITE='FFFFFFFF'
    ALT1='FFF2F7FB'; ALT2='FFFFFFFF'; BDR='FFB8CCE4'
    COMP_CLR = {
        'PIPE':'FFDEEBF7','FITTINGS':'FFE2EFDA','FLANGES':'FFFCE4D6',
        'GASKETS':'FFFFF2CC','VALVES':'FFEDEDED','SUPPORTS':'FFF4B8B8',
        'INSTRUMENTS':'FFE2D9F3','BOLTS':'FFDDDDDD',
    }

    def __init__(self):
        self.wb = Workbook(); self.wb.remove(self.wb.active)

    def _hf(self): return Font(name='Calibri',bold=True,color=self.WHITE,size=10)
    def _df(self,b=False): return Font(name='Calibri',bold=b,size=9)
    def _br(self):
        s=Side(style='thin',color=self.BDR)
        return Border(left=s,right=s,top=s,bottom=s)
    def _af(self,i): return PatternFill('solid',fgColor=self.ALT1 if i%2==0 else self.ALT2)
    def _fill(self,c): return PatternFill('solid',fgColor=c)

    def _hdr(self,ws,cols,color=None):
        f=PatternFill('solid',fgColor=color or self.NAVY)
        for ci,(h,w) in enumerate(cols,1):
            c=ws.cell(row=1,column=ci,value=h)
            c.font=self._hf(); c.fill=f
            c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
            c.border=self._br()
            ws.column_dimensions[get_column_letter(ci)].width=w
        ws.row_dimensions[1].height=30

    def _dc(self,ws,row,col,val,fill=None,al='left',bold=False):
        c=ws.cell(row=row,column=col,value=val)
        c.font=self._df(bold)
        if fill: c.fill=fill
        c.border=self._br()
        c.alignment=Alignment(horizontal=al,vertical='center',wrap_text=True)

    def write_mto(self, items:List[MTOItem]):
        ws=self.wb.create_sheet('MTO'); ws.freeze_panes='A2'
        cols=[('Line No',34),('Rev No',8),('Sheet No',8),
              ('Item No',8),('Component',14),('Description',58),
              ('Size (DN)',10),('DAN Code',22),('Qty',10),('Unit',7),('Weight (Kg)',12)]
        self._hdr(ws,cols)
        for ri,it in enumerate(items,1):
            row=ri+1; af=self._af(ri)
            cf=self._fill(self.COMP_CLR.get(it.component,'FFECF0F1'))
            vals=[it.line_no,it.rev_no,it.sheet_no,it.item_no,it.component,
                  it.description,it.size_dn,it.dan_code,it.qty,it.unit,it.weight]
            als=['left','center','center','center','center','left',
                 'center','center','center','center','right']
            for ci,(v,al) in enumerate(zip(vals,als),1):
                self._dc(ws,row,ci,v,cf if ci==5 else af,al,ci==5)
        ws.auto_filter.ref=f"A1:{get_column_letter(len(cols))}1"
        print(f'  📊 MTO: {len(items)} satır')

    def write_weld_log(self, joints:List[WeldJoint]):
        ws=self.wb.create_sheet('Weld_Log'); ws.freeze_panes='A2'
        cols=[('Line No',34),('Joint No',10),('Rev No',8),('Sheet No',8),
              ('Item 1',8),('Desc 1',40),('DAN Code 1',22),
              ('Size 1 DN',10),('Size 1 mm',10),('Size 1 Inch',10),('Thk 1 mm',10),
              ('Item 2',8),('Desc 2',40),('DAN Code 2',22),
              ('Size 2 DN',10),('Size 2 mm',10),('Size 2 Inch',10),('Thk 2 mm',10)]
        self._hdr(ws,cols,color=self.TEAL)
        for ri,j in enumerate(joints,1):
            row=ri+1; af=self._af(ri)
            vals=[j.line_no,j.joint_no,j.rev_no,j.sheet_no,
                  j.item1,j.desc1,j.dan_code1,j.size1_dn,j.size1_mm,j.size1_inch,j.thk1_mm,
                  j.item2,j.desc2,j.dan_code2,j.size2_dn,j.size2_mm,j.size2_inch,j.thk2_mm]
            als=['left','center','center','center','center','left','center',
                 'center','center','center','center','center','left','center',
                 'center','center','center','center']
            for ci,(v,al) in enumerate(zip(vals,als),1):
                self._dc(ws,row,ci,v,af,al)
        ws.auto_filter.ref=f"A1:{get_column_letter(len(cols))}1"
        print(f'  📊 Weld Log: {len(joints)} kaynak')

    def write_cut_list(self, items:List[CutItem]):
        ws=self.wb.create_sheet('Cut_List'); ws.freeze_panes='A2'
        cols=[('Line No',34),('Sheet No',8),('Piece No',10),
              ('Length (mm)',13),('Size (DN)',10),('End Prep',12),('Remarks',20)]
        self._hdr(ws,cols,color=self.GREEN)
        for ri,it in enumerate(items,1):
            row=ri+1; af=self._af(ri)
            vals=[it.line_no,it.sheet_no,it.piece_no,it.length,it.size_dn,it.end_prep,it.remarks]
            als=['left','center','center','right','center','center','left']
            for ci,(v,al) in enumerate(zip(vals,als),1):
                self._dc(ws,row,ci,v,af,al)
        ws.auto_filter.ref=f"A1:{get_column_letter(len(cols))}1"
        print(f'  📊 Cut List: {len(items)} parça')

    def write_support_list(self, items:List[SupportItem]):
        ws=self.wb.create_sheet('Support_List'); ws.freeze_panes='A2'
        cols=[('Line No',34),('Rev No',8),('Sheet No',8),
              ('Support Ref',22),('Type',14),('Size (DN)',10),('Quantity',10)]
        self._hdr(ws,cols,color=self.BROWN)
        for ri,it in enumerate(items,1):
            row=ri+1; af=self._af(ri)
            vals=[it.line_no,it.rev_no,it.sheet_no,it.support_ref,it.support_type,it.size_dn,it.quantity]
            als=['left','center','center','center','center','center','center']
            for ci,(v,al) in enumerate(zip(vals,als),1):
                self._dc(ws,row,ci,v,af,al)
        ws.auto_filter.ref=f"A1:{get_column_letter(len(cols))}1"
        print(f'  📊 Support List: {len(items)} adet')

    def write_summary(self, mto, welds, cuts, supports):
        ws=self.wb.create_sheet('OZET',0)
        ws.sheet_view.showGridLines=False
        ws.merge_cells('B2:H2')
        t=ws['B2']; t.value='BORU ÇİZİM VERİ ÇIKARMA RAPORU'
        t.font=Font(name='Calibri',bold=True,size=16,color=self.NAVY)
        t.alignment=Alignment(horizontal='center',vertical='center')
        ws.row_dimensions[2].height=35
        ws.merge_cells('B3:H3')
        s=ws['B3']; s.value='MTO  |  Weld Log  |  Cut List  |  Support List'
        s.font=Font(name='Calibri',size=10,color=self.BLUE,italic=True)
        s.alignment=Alignment(horizontal='center')

        for i,(label,cnt,color) in enumerate([
            ('MTO Satır',len(mto),self.BLUE),
            ('Weld Kaynağı',len(welds),'FF548235'),
            ('Cut Parça',len(cuts),'FFC55A11'),
            ('Destek',len(supports),'FF7030A0'),
        ]):
            col=2+i*2
            ws.merge_cells(start_row=5,start_column=col,end_row=5,end_column=col+1)
            ws.merge_cells(start_row=6,start_column=col,end_row=6,end_column=col+1)
            lc=ws.cell(row=5,column=col,value=label)
            lc.font=Font(name='Calibri',bold=True,size=9,color=self.WHITE)
            lc.fill=PatternFill('solid',fgColor=color)
            lc.alignment=Alignment(horizontal='center',vertical='center')
            cc=ws.cell(row=6,column=col,value=cnt)
            cc.font=Font(name='Calibri',bold=True,size=18,color=color)
            cc.fill=PatternFill('solid',fgColor=self.WHITE)
            cc.alignment=Alignment(horizontal='center',vertical='center')
            ws.row_dimensions[5].height=18; ws.row_dimensions[6].height=35

        ws.cell(row=8,column=2,value='Çizim Özeti').font=Font(name='Calibri',bold=True,size=11,color=self.NAVY)
        for ci,h in enumerate(['Line No','MTO','Cut','Destek','Weld'],2):
            c=ws.cell(row=9,column=ci,value=h)
            c.font=Font(name='Calibri',bold=True,size=9,color=self.WHITE)
            c.fill=PatternFill('solid',fgColor=self.NAVY)
            c.alignment=Alignment(horizontal='center',vertical='center')
        ws.row_dimensions[9].height=22

        sm:dict={}
        for x in mto:     sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][0]+=1
        for x in cuts:    sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][1]+=1
        for x in supports:sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][2]+=1
        for x in welds:   sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][3]+=1

        for ri,(ln,st) in enumerate(sorted(sm.items()),1):
            row=9+ri; af=PatternFill('solid',fgColor=self.ALT1 if ri%2 else self.ALT2)
            for ci,v in enumerate([ln]+st,2):
                c=ws.cell(row=row,column=ci,value=v)
                c.fill=af; c.font=Font(name='Calibri',size=9)
                c.alignment=Alignment(horizontal='left' if ci==2 else 'center',vertical='center')
                c.border=Border(bottom=Side(style='thin',color='FFD9D9D9'))

        for c in range(1,12): ws.column_dimensions[get_column_letter(c)].width=5
        ws.column_dimensions['B'].width=40
        for ch in 'CDEFGH': ws.column_dimensions[ch].width=14

    def save(self, path:str):
        self.wb.save(path); print(f'\n  💾 Kaydedildi: {path}')


# ── ENTRY POINT ──────────────────────────────────────────────
def main():
    pdf_folder = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Piping_Data_Extracted_v2.xlsx')

    print(f'\n{"="*60}')
    print(f'  BORU İZOMETRİK VERİ ÇIKARICI v2')
    print(f'  Klasör: {pdf_folder}')
    print(f'{"="*60}')

    ext = PipingDataExtractor(pdf_folder)
    ext.process_all()

    w = ExcelWriter()
    print('\n  Excel yazılıyor...')
    w.write_summary(ext.all_mto, ext.all_welds, ext.all_cuts, ext.all_supports)
    w.write_mto(ext.all_mto)
    w.write_weld_log(ext.all_welds)
    w.write_cut_list(ext.all_cuts)
    w.write_support_list(ext.all_supports)
    w.save(out)
    return out

if __name__ == '__main__':
    main()
