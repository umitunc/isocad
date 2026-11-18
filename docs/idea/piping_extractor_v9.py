#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔═══════════════════════════════════════════════════════════════════╗
║  PIPING ISOMETRIC DATA EXTRACTOR  v9.0  (Production)             ║
║  ─────────────────────────────────────────────────────────────── ║
║  Desteklenen formatlar:                                           ║
║   • Danieli Standard  (GN-*, QWR-*, PG-*, CWR-*-FA)             ║
║   • Danieli Russian   (GN-400, CWR-800 Rus başlıklı)            ║
║   • Linde / Energiron (DW-150, FE51598)                         ║
║   • Adobe FreeText Annotation PDFs (RV2, TL-25, CWR-20)         ║
║  Yöntemler:                                                       ║
║   1. pdfplumber word-position MTO parser (birincil)              ║
║   2. PyMuPDF annotation layer (Adobe eklentileri)                ║
║   3. Line-by-line state-machine (yedek)                          ║
╚═══════════════════════════════════════════════════════════════════╝
"""
import os, re, sys, glob
from pathlib import Path
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional, List, Dict

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    import fitz
    HAS_MUPDF = True
except ImportError:
    HAS_MUPDF = False
    print("⚠  PyMuPDF yok. 'pip install pymupdf' ile kurun (Adobe annotation desteği için)")

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
    HAS_TK = True
except ImportError:
    HAS_TK = False

# ════════════════════════════════════════════════════════
# SABITLER
# ════════════════════════════════════════════════════════
DN_TO_INCH: Dict[int,str] = {
    15:'1/2"',20:'3/4"',25:'1"',32:'1-1/4"',40:'1-1/2"',
    50:'2"',65:'2-1/2"',80:'3"',100:'4"',125:'5"',150:'6"',
    200:'8"',250:'10"',300:'12"',350:'14"',400:'16"',
    450:'18"',500:'20"',600:'24"',700:'28"',800:'32"',
    900:'36"',1000:'40"',1200:'48"',
}
COMP_KW = {
    'PIPE':        ['PIPE','ТРУБА'],
    'FLANGES':     ['FLANGE','ФЛАНЕЦ','ФЛАНЦЫ','SW-FLANGE'],
    'GASKETS':     ['GASKET','ПРОКЛАДКА','УПЛОТНЕНИЕ'],
    'VALVES':      ['VALVE','КЛАПАН','ЗАДВИЖКА','BUTTERFLY','GATE',
                    'GLOBE','BALL','CHECK','ЗАТВОР','ШАРОВОЙ'],
    'FITTINGS':    ['ELBOW','TEE','REDUCER','COUPLING','CAP','NIPPLE',
                    'WELDOLET','SOCKOLET','SPECTACLE','SPACER',
                    'OBSTRUCTION','КОЛЕНО','ТРОЙНИК','ПЕРЕХОД',
                    'МУФТА','ЗАГЛУШКА','ПОЛУНИППЕЛЬ','БОБЫШКА'],
    'SUPPORTS':    ['SUPPORT','HANGER','U-BOLT','REST','GUIDE','SPRING',
                    'HOLD','ОПОРА','U-БОЛ','unset','Generic'],
    'INSTRUMENTS': ['INSTRUMENT','INDICATOR','TRANSMITTER','ПРИБОРЫ',
                    'FA00-','FE21-','unset FA'],
    'BOLTS':       ['BOLT','NUT','STUD'],
}
# Danieli standart sütun oranları (page_w * oran)
# GN-80/250/QWR → pw=2384, GN-400 → pw=2384, PG-/CWR- → pw=3370
# Tüm Danieli şablonları aynı oranları kullanıyor!
DANIELI_COLS = {
    'item':   (0.715, 0.733),
    'desc':   (0.733, 0.852),
    'size':   (0.852, 0.883),
    'dan':    (0.883, 0.921),
    'qty':    (0.921, 0.952),
    'weight': (0.952, 1.001),
}
# Linde/Energiron sütun oranları (pw ≈ 1191)
LINDE_COLS = {
    'item':   (0.780, 0.830),
    'desc':   (0.830, 0.900),
    'size':   (0.900, 0.930),
    'dan':    (0.930, 0.960),
    'qty':    (0.960, 0.985),
    'weight': (0.985, 1.001),
}

# ════════════════════════════════════════════════════════
# VERİ SINIFLARI
# ════════════════════════════════════════════════════════
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
    description:str=''; size_dn:str=''; quantity:str=''

@dataclass
class WeldJoint:
    line_no:str=''; joint_no:int=0; rev_no:str=''; sheet_no:str=''
    item1:str=''; desc1:str=''; dan_code1:str=''
    size1_dn:str=''; size1_mm:str=''; size1_inch:str=''; thk1_mm:str=''
    item2:str=''; desc2:str=''; dan_code2:str=''
    size2_dn:str=''; size2_mm:str=''; size2_inch:str=''; thk2_mm:str=''

# ════════════════════════════════════════════════════════
# YARDIMCI FONKSİYONLAR
# ════════════════════════════════════════════════════════
def dn_inch(dn:str) -> str:
    try:
        v = int(float(str(dn).split('x')[0].split('X')[0].strip()))
        return DN_TO_INCH.get(v, f'{round(v/25.4,2)}"')
    except: return dn or ''

def parse_dn(s:str) -> str:
    if not s: return ''
    m = re.match(r'(\d+)', str(s).strip())
    return m.group(1) if m else str(s).strip()

def dn_val(s:str) -> int:
    try: return int(float(str(s).split('x')[0].split('X')[0].strip()))
    except: return 0

def parse_thk(desc:str) -> str:
    m = re.search(r'[Tt]hk\.?(\d+[.,]\d+)\s*mm', str(desc))
    if m: return m.group(1).replace(',','.')
    m = re.search(r'Толщина\s+(\d+[.,]\d+)\s*mm', str(desc))
    return m.group(1).replace(',','.') if m else ''

def norm_dan(parts:List[str]) -> str:
    combined = ''.join(parts).replace(' ','')
    combined = re.sub(r'-+','-',combined).rstrip('-')
    if re.match(r'^\d{3}-\d{3}-\d{3}-\d{3}$', combined): return combined
    digits = combined.replace('-','')
    if len(digits)==12 and digits.isdigit():
        return f'{digits[:3]}-{digits[3:6]}-{digits[6:9]}-{digits[9:]}'
    m = re.match(r'(\d{3}-\d{3}-\d{3})-?(\d{1,3})?$', combined)
    if m: return f'{m.group(1)}-{(m.group(2) or "").zfill(3)}'
    # Alternatif "0.636999.G"
    if re.match(r'^0\.\d{5,7}\.[A-Z]$', combined): return combined
    return combined or '-'

def classify_comp(desc:str) -> str:
    up = desc.upper()
    for comp, kws in COMP_KW.items():
        if any(k.upper() in up for k in kws): return comp
    return 'FITTINGS'

def detect_sup_type(desc:str) -> str:
    u = desc.upper()
    if 'SPRING' in u: return 'Spring'
    if 'GUIDE' in u: return 'Guide'
    if 'HOLD' in u or 'AXIAL' in u: return 'Hold-Down'
    if 'REST' in u: return 'Rest'
    if 'U-BOLT' in u or 'U-БОЛ' in u: return 'U-Bolt'
    if 'HANGER' in u: return 'Hanger'
    return 'Rigid'

def group_rows(words:list, tol:float=4) -> list:
    if not words: return []
    sw = sorted(words, key=lambda w: w['top'])
    rows, cy, cr = [], sw[0]['top'], []
    for w in sw:
        if abs(w['top']-cy) <= tol: cr.append(w)
        else:
            rows.append((cy, sorted(cr, key=lambda x: x['x0'])))
            cr, cy = [w], w['top']
    if cr: rows.append((cy, sorted(cr, key=lambda x: x['x0'])))
    return rows

# ════════════════════════════════════════════════════════
# ADOBE ANNOTATION ÇIKARICI
# ════════════════════════════════════════════════════════
def extract_annotations(pdf_path:str) -> List[str]:
    """PyMuPDF ile FreeText annotation içeriklerini çıkarır."""
    if not HAS_MUPDF: return []
    texts = []
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            # Temel metin (pdfplumber'ın kaçırdıkları için)
            mu_text = page.get_text()
            # FreeText annotation'lar
            for annot in page.annots():
                content = annot.info.get('content','').strip()
                if content and annot.type[1] == 'FreeText':
                    texts.append(content)
        doc.close()
    except Exception as e:
        print(f"    ⚠ PyMuPDF annotation: {e}")
    return texts

def get_full_text_mupdf(pdf_path:str) -> str:
    """PyMuPDF ile tam metni (annotation dahil) alır."""
    if not HAS_MUPDF: return ''
    try:
        doc = fitz.open(pdf_path)
        parts = []
        for page in doc:
            parts.append(page.get_text())
            for annot in page.annots():
                c = annot.info.get('content','').strip()
                if c: parts.append(c)
        doc.close()
        return '\n'.join(parts)
    except: return ''

# ════════════════════════════════════════════════════════
# MTO PARSER 1: WORD-POSITION (Danieli standard + Linde)
# ════════════════════════════════════════════════════════
class MTOWordParser:
    """
    Kelime koordinatlarına dayalı sütun ayrımı.
    Danieli şablonları (EN + RU) ve Linde şablonunu destekler.
    """
    # İngilizce bölüm başlıkları
    SEC_EN = {
        'PIPE':'PIPE','FITTINGS':'FITTINGS','FLANGES':'FLANGES',
        'GASKETS':'GASKETS','VALVES':'VALVES',
        'VALVES/IN-LINEITEMS':'VALVES','VALVES/IN-LINE ITEMS':'VALVES',
        'SUPPORTS':'SUPPORTS','INSTRUMENTS':'INSTRUMENTS','BOLTS':'BOLTS',
    }
    # Rusça bölüm başlıkları
    SEC_RU = {
        'ТРУБА':'PIPE','ФИТИНГИ':'FITTINGS','ФЛАНЦЫ':'FLANGES',
        'ПРОКЛАДКИ':'GASKETS','КЛАПАНЫ':'VALVES',
        'КЛАПАНЫ/ЭЛЕМЕНТЫНАСОПРОВОДЕ':'VALVES',
        'КЛАПАНЫ/ЭЛЕМЕНТЫНАСОПРОВОД':'VALVES',
        'ОПОРЫ':'SUPPORTS','ПРИБОРЫ':'INSTRUMENTS',
    }
    # Sütun bitiş etiketleri
    END_PATS = re.compile(
        r'TOTAL\s*(FAB|ERECT|WEIGHT)|ОБЩИЙ\s*ВЕС|'
        r'TOTALWEIGHT|TOTAL ERECTION WEIGHT|TOTAL FABRICATION WEIGHT',
        re.I
    )
    START_FAB = re.compile(
        r'FABRICATION\s*MATERIALS?|МАТЕРИАЛЫ\s*ДЛЯ\s*ИЗГОТОВЛЕНИЯ', re.I
    )
    START_ERE = re.compile(
        r'ERECTION\s*MATERIALS?|МОНТАЖНЫЕ\s*МАТЕРИАЛЫ', re.I
    )

    def detect_cols(self, pw:float) -> dict:
        """Sayfa genişliğine göre sütun oranlarını seç."""
        if pw < 1500: return LINDE_COLS   # Linde ≈ 1191
        return DANIELI_COLS                # Danieli ≈ 2384 veya 3370

    def parse(self, page, line_no:str, rev_no:str, sheet_no:str) -> List[MTOItem]:
        words = page.extract_words()
        pw = page.width
        cols = self.detect_cols(pw)
        # MTO alanı: MTO tablo başlangıcı
        threshold = min(lo for lo,hi in cols.values()) - 0.02
        mto_words = [w for w in words if w['x0'] >= pw * threshold]
        if not mto_words: return []

        rows = group_rows(mto_words, tol=5)
        items:List[MTOItem] = []
        in_fab = in_erect = False
        cur_sec = ''
        cur = None

        def flush():
            nonlocal cur
            if cur:
                it = self._build(cur, cur_sec, line_no, rev_no, sheet_no, pw, cols)
                if it: items.append(it)
            cur = None

        for _, rw in rows:
            text = ' '.join(w['text'] for w in rw).strip()
            txt_clean = re.sub(r'\s+','',text).upper()  # boşuksuz büyük harf

            # Başlık satırlarını atla
            if re.match(r'^(ITEM|COMPONENT|DESCRIPTION|SIZE|DAN\s*CODE|QTY|WEIGHT|'
                        r'\(DN\)|\(Kg\)|ПОЗИ|ЦИЯ|ОПИСАНИЕ|РАЗМЕР|КОЛИЧЕСТ|ВО|'
                        r'КОД DANIELI|PT\s*NO|N\.S\.|PTNO)', text.strip(), re.I):
                continue

            # Blok başlangıç
            if self.START_FAB.match(text):
                flush(); in_fab=True; in_erect=False; continue
            if self.START_ERE.match(text):
                flush(); in_erect=True; in_fab=False; continue

            if not in_fab and not in_erect: continue

            # Blok bitiş
            if self.END_PATS.search(text):
                flush()
                if 'TOTAL WEIGHT' in text.upper() or 'ОБЩИЙ ВЕС' in text.upper():
                    in_fab = in_erect = False
                continue

            # Bölüm başlığı (EN + RU)
            sec = self.SEC_EN.get(txt_clean) or self.SEC_RU.get(txt_clean)
            if not sec:
                # Kısmi eşleşme (boşuklu ve boşuksuz varyant)
                for k,v in {**self.SEC_EN,**self.SEC_RU}.items():
                    if txt_clean == k.replace(' ','').upper():
                        sec=v; break
            if sec:
                flush(); cur_sec=sec; continue

            # Sütun verileri
            c = self._split_cols(rw, pw, cols)
            item_t = c['item'].strip()
            desc_t = c['desc'].strip()
            size_t = c['size'].strip()
            dan_t  = c['dan'].strip()
            qty_t  = c['qty'].strip()
            wt_t   = c['weight'].strip()

            # DAN devamı (sadece rakam DAN konumunda + önceki item var)
            if dan_t and re.match(r'^\d{1,4}$', dan_t) and cur and not item_t:
                cur['dan_raw'].append(dan_t)
                if desc_t: cur['desc_parts'].append(desc_t)
                continue

            # Yeni item
            if re.match(r'^\d{1,3}$', item_t) and desc_t:
                flush()
                cur = {'item_no':item_t,'desc_parts':[desc_t],
                       'size':size_t,'dan_raw':[dan_t] if dan_t else [],
                       'qty':qty_t,'weight':wt_t}
            elif cur and (desc_t or dan_t or qty_t or wt_t):
                if desc_t: cur['desc_parts'].append(desc_t)
                if dan_t:  cur['dan_raw'].append(dan_t)
                if not cur['qty']    and qty_t:  cur['qty']    = qty_t
                if not cur['weight'] and wt_t:   cur['weight'] = wt_t
                if not cur['size']   and size_t: cur['size']   = size_t

        flush()
        return items

    def _split_cols(self, rw:list, pw:float, cols:dict) -> dict:
        c = {k:'' for k in cols}
        for w in rw:
            rel = w['x0'] / pw
            matched = False
            for cn,(lo,hi) in cols.items():
                if lo <= rel < hi:
                    c[cn] = (c[cn]+' '+w['text']).strip()
                    matched = True; break
            if not matched:
                best = min(cols, key=lambda k: abs(rel-(cols[k][0]+cols[k][1])/2))
                c[best] = (c[best]+' '+w['text']).strip()
        return c

    def _build(self, d:dict, sec:str, line_no, rev_no, sheet_no, pw, cols) -> Optional[MTOItem]:
        if not d or not d.get('item_no'): return None
        desc = re.sub(r'\s+',' ',' '.join(d['desc_parts'])).strip()
        if not desc or desc.upper() in (
            'PIPE','FITTINGS','FLANGES','GASKETS','VALVES','SUPPORTS','BOLTS'):
            return None

        dan = norm_dan(d.get('dan_raw',[]))
        size_dn = parse_dn(d.get('size',''))
        qty = d.get('qty','').strip()
        wt  = d.get('weight','').strip()

        # Weight'te çift değer varsa düzelt
        if not qty and wt:
            parts = wt.split()
            if len(parts) >= 2: qty=parts[-2]; wt=parts[-1]

        comp = sec if sec else classify_comp(desc)
        unit = 'M' if comp=='PIPE' else 'ADT'
        return MTOItem(
            line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
            item_no=d['item_no'], component=comp,
            description=desc[:120], size_dn=size_dn,
            dan_code=dan, qty=qty, unit=unit, weight=wt,
        )


# ════════════════════════════════════════════════════════
# MTO PARSER 2: LINE-BY-LINE STATE MACHINE (Yedek)
# ════════════════════════════════════════════════════════
class MTOTextParser:
    """
    Her alanın ayrı satırda olduğu metin yapısı için state machine.
    Danieli: ITEM_NO / DESC×N / SIZE / DAN / QTY / WEIGHT
    Linde:   POS IDENT NPD DESCRIPTION QTY  (tek satır)
    """
    SEC_MAP = {
        'PIPE':'PIPE','FITTINGS':'FITTINGS','FLANGES':'FLANGES',
        'GASKETS':'GASKETS','VALVES':'VALVES',
        'VALVES / IN-LINE ITEMS':'VALVES','SUPPORTS':'SUPPORTS',
        'INSTRUMENTS':'INSTRUMENTS','BOLTS':'BOLTS',
        'ТРУБА':'PIPE','ФИТИНГИ':'FITTINGS','ФЛАНЦЫ':'FLANGES',
        'ПРОКЛАДКИ':'GASKETS','КЛАПАНЫ':'VALVES',
        'КЛАПАНЫ / ЭЛЕМЕНТЫ НА ЛИНИИ':'VALVES',
        'ОПОРЫ':'SUPPORTS','ПРИБОРЫ':'INSTRUMENTS',
    }
    FAB_START = re.compile(
        r'FABRICATION\s*MATERIALS?|МАТЕРИАЛЫ\s*ДЛЯ\s*ИЗГОТОВЛЕНИЯ|'
        r'ERECTION\s*MATERIALS?|МОНТАЖНЫЕ\s*МАТЕРИАЛЫ', re.I)
    FAB_END = re.compile(
        r'TOTAL\s*(FABRICATION|ERECTION|WEIGHT)|ОБЩИЙ\s*ВЕС|'
        r'CUT\s*PIPE|ОТРЕЗАТЬ\s*ДЛИНУ', re.I)
    SKIP = re.compile(
        r'^(ITEM|COMPONENT|DESCRIPTION|ПОЗИ|ЦИЯ|ОПИСАНИЕ|РАЗМЕР|SIZE|'
        r'DAN\s*CODE|КОД\s*DANIELI|QTY|WEIGHT|PT\s*NO|N\.S\.|PTNO|'
        r'\(DN\)|\(Kg\)|КОЛИЧЕСТ|ВЕС\s*\(кг\)|ВО|PIPING\s*MATERIAL)$', re.I)
    IS_ITEM = re.compile(r'^\d{1,3}$')
    IS_SIZE = re.compile(r'^\d{2,4}(\s*[xXхХ]\s*\d{1,4})?$')
    IS_INCH = re.compile(r'^\d{1,2}(/\d{1,2})?(\s*[xX]\s*\d{1,2}(/\d{1,2})?)?$')
    IS_DAN  = re.compile(r'^\d{3}-\d{3}-\d{3}-\d{3}$')
    IS_DANP = re.compile(r'^\d{3}-\d{3}-\d{3}-$')
    IS_DANA = re.compile(r'^0\.\d{5,7}\.[A-Z]$')
    IS_CODE = re.compile(r'^[A-Z][A-Z0-9_]{2,12}$')
    IS_QTY  = re.compile(r'^[\d\.]+\s*[MmFfLlTt]?$')
    IS_WT   = re.compile(r'^[\d\.,]+$')

    def parse(self, text:str, line_no:str, rev_no:str, sheet_no:str) -> List[MTOItem]:
        # Önce Linde/BOM formatını dene
        linde = self._parse_linde(text, line_no, rev_no, sheet_no)
        if linde: return linde

        result:List[MTOItem] = []
        lines = [l.strip() for l in text.splitlines()]
        in_mat=False; section=''
        ino=None; desc_buf=[]; size=dan=qty=''
        state='W'

        def emit(w):
            nonlocal ino,desc_buf,size,dan,qty,state
            if ino and desc_buf:
                desc = ' '.join(desc_buf).strip()
                comp = classify_comp(desc + ' ' + section)
                if section: comp = section
                result.append(MTOItem(
                    line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                    item_no=ino, component=comp,
                    description=desc[:120], size_dn=parse_dn(size),
                    dan_code=norm_dan([dan]) if dan else '-',
                    qty=qty, unit='M' if comp=='PIPE' else 'ADT',
                    weight=str(w).replace(',','.') if w else '0.00',
                ))
            ino=None; desc_buf=[]; size=dan=qty=''; state='W'

        idx=0
        while idx < len(lines):
            s=lines[idx]; idx+=1
            if not s: continue
            if self.FAB_START.search(s):
                emit(None); in_mat=True; state='W'; continue
            if in_mat and self.FAB_END.search(s):
                emit(None); in_mat=False; state='W'; continue
            if not in_mat: continue
            if self.SKIP.match(s): continue

            sec = self.SEC_MAP.get(s.upper()) or self.SEC_MAP.get(
                re.sub(r'\s+','',s).upper()
            )
            if sec: emit(None); section=sec; state='W'; continue

            if state=='W':
                if self.IS_ITEM.match(s): emit(None); ino=s; state='D'
            elif state=='D':
                if self.IS_ITEM.match(s) and desc_buf: emit(None); ino=s; state='D'
                elif (self.IS_SIZE.match(s) or self.IS_INCH.match(s)) and desc_buf:
                    size=s; state='S'
                else: desc_buf.append(s)
            elif state=='S':
                if self.IS_DAN.match(s): dan=s; state='Q'
                elif self.IS_DANP.match(s):
                    if idx<len(lines) and re.match(r'^\d{3}$',lines[idx]):
                        dan=s+lines[idx]; idx+=1
                    else: dan=s
                    state='Q'
                elif self.IS_DANA.match(s): dan=s; state='Q'
                elif self.IS_CODE.match(s): dan=s; state='Q'
                elif self.IS_QTY.match(s): qty=s; state='Wt'
                elif self.IS_ITEM.match(s): emit(None); ino=s; state='D'
            elif state=='Q':
                if self.IS_QTY.match(s): qty=s; state='Wt'
                elif self.IS_ITEM.match(s): emit(None); ino=s; state='D'
            elif state=='Wt':
                if self.IS_WT.match(s): emit(s); state='W'
                elif self.IS_ITEM.match(s): emit(None); ino=s; state='D'
        emit(None)
        return result

    def _parse_linde(self, text:str, line_no, rev_no, sheet_no) -> List[MTOItem]:
        """
        Linde BOM formatı:
          POS IDENT NPD DESCRIPTION QTY
          1 811092 1 PIPE#SMLS. 1 * XS, ASTM A333 GR.6 1416 MM
        """
        items:List[MTOItem] = []
        m = re.search(r'POS\s+IDENT\s+NPD\s+DESCRIPTION\s+QTY', text, re.I)
        if not m: return items
        block = text[m.end():]
        # Satır: N IDENT NPD DESC QTY
        row_pat = re.compile(
            r'^(\d{1,2})\s+([A-Z0-9]{5,8})\s+(\d{1,2}(?:[xX]\d{1,2})?)\s+'
            r'(.+?)\s+(\d+)\s*$', re.MULTILINE)
        for rm in row_pat.finditer(block):
            item_no = rm.group(1)
            ident   = rm.group(2)
            size_s  = rm.group(3)
            desc_s  = rm.group(4).strip()
            qty_s   = rm.group(5)
            comp = classify_comp(desc_s)
            items.append(MTOItem(
                line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                item_no=item_no, component=comp,
                description=desc_s[:120], size_dn=size_s,
                dan_code=ident, qty=qty_s,
                unit='M' if comp=='PIPE' else 'ADT', weight='',
            ))
        return items


# ════════════════════════════════════════════════════════
# CUT LIST PARSER
# ════════════════════════════════════════════════════════
class CutListParser:
    def parse(self, page, line_no:str, sheet_no:str,
              annot_text:str='') -> List[CutItem]:
        items:List[CutItem] = []
        seen:set = set()

        # pdfplumber word-position yöntemi
        words = page.extract_words()
        pw = page.width
        # CUT PIPE LENGTH genellikle MTO alanındaki gibi sağda
        threshold = 0.67
        mto_words = [w for w in words if w['x0'] >= pw*threshold]
        rows = group_rows(mto_words, tol=5)
        in_cut = False
        for _, rw in rows:
            text = ' '.join(w['text'] for w in rw).strip()
            text_clean = re.sub(r'\s+','',text).upper()
            if re.search(r'CUT\s*PIPE\s*LENGTH|ОТРЕЗАТЬ\s*ДЛИНУ', text, re.I):
                in_cut=True; continue
            if not in_cut: continue
            if re.match(r'^(PIECE|CUT|SIZE|REMARKS|END|NO|LENGTH|DN|PREP|'
                        r'ШТУКИ|ОТРЕЗАТЬ|РАЗМЕР|КОНЦАТР)', text, re.I): continue
            # <N> length size [remarks] end_prep
            m = re.match(
                r'(<\d+>)\s+(\d+)\s+(\d{2,4})'
                r'(?:\s+(PLD\s*BEND|3D\s*BEND|4D\s*BEND))?'
                r'(?:\s+(BE/BE|BE/PE|PE/PE|PE/BE|TH/BE|BE/TH))?',
                text.strip(), re.I)
            if m:
                key=(m.group(1),m.group(3))
                if key not in seen:
                    seen.add(key)
                    items.append(CutItem(
                        line_no=line_no, sheet_no=sheet_no,
                        piece_no=m.group(1), length=m.group(2),
                        size_dn=m.group(3),
                        end_prep=(m.group(5) or '').strip(),
                        remarks=(m.group(4) or '').strip(),
                    ))

        # Metin tabanlı yedek (annotation dahil)
        if not items:
            full = (page.extract_text() or '') + '\n' + annot_text
            items = self._text_fallback(full, line_no, sheet_no, seen)

        return items

    def _text_fallback(self, text:str, line_no:str, sheet_no:str, seen:set) -> List[CutItem]:
        items:List[CutItem] = []
        m = re.search(r'CUT\s*PIPE\s*LENGTH|ОТРЕЗАТЬ\s*ДЛИНУ\s*ТРУБЫ', text, re.I)
        if not m: return items
        block = text[m.end():]
        pat = re.compile(
            r'<(\d+)>\s+(\d{2,6})\s+(\d{2,4})\s*'
            r'(?:(PLD\s*BEND|3D\s*BEND|4D\s*BEND)\s*)?'
            r'(BE/BE|BE/PE|PE/PE|PE/BE|TH/BE|BE/TH)?', re.I)
        for rm in pat.finditer(block):
            key=(f'<{rm.group(1)}>', rm.group(3))
            if key in seen: continue
            seen.add(key)
            items.append(CutItem(
                line_no=line_no, sheet_no=sheet_no,
                piece_no=f'<{rm.group(1)}>', length=rm.group(2),
                size_dn=rm.group(3),
                end_prep=(rm.group(5) or '').strip(),
                remarks=(rm.group(4) or '').strip(),
            ))
        return items


# ════════════════════════════════════════════════════════
# SUPPORT PARSER
# ════════════════════════════════════════════════════════
class SupportParser:
    FA_REF = re.compile(r'\b(FA\d{2}-[A-Z]-\d+(?:[./]\d+)?(?:/\d+)?)\b', re.I)
    SP_REF = re.compile(r'\b(SP-\d+[A-Z]?|SPS-\d+|PS-\d+)\b', re.I)

    def parse(self, full_text:str, mto_items:List[MTOItem],
              line_no:str, rev_no:str, sheet_no:str) -> List[SupportItem]:
        items:List[SupportItem] = []
        seen:set = set()

        # MTO'dan destek kalemleri
        for m in mto_items:
            if m.component == 'SUPPORTS':
                try: qty = int(float(re.sub(r'[MmFtADT]','',m.qty or '1')))
                except: qty = 1
                ref = f'SUP-{m.item_no}'
                if ref not in seen:
                    seen.add(ref)
                    items.append(SupportItem(
                        line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                        support_ref=ref,
                        support_type=detect_sup_type(m.description),
                        description=m.description[:80],
                        size_dn=m.size_dn, quantity=str(qty),
                    ))

        # Çizimden FA00-S-xxx, SP-xx referansları
        for pat in [self.FA_REF, self.SP_REF]:
            for mm in pat.finditer(full_text):
                ref = mm.group(1).upper()
                if ref not in seen:
                    seen.add(ref)
                    items.append(SupportItem(
                        line_no=line_no, rev_no=rev_no, sheet_no=sheet_no,
                        support_ref=ref, support_type='Rigid',
                        description=f'Support {ref}', size_dn='', quantity='1',
                    ))
        return items


# ════════════════════════════════════════════════════════
# WELD LOG GENERATOR
# ════════════════════════════════════════════════════════
class WeldLogGenerator:
    def generate(self, page_text:str, mto_items:List[MTOItem],
                 cut_items:List[CutItem], annot_text:str,
                 line_no:str, rev_no:str, sheet_no:str,
                 start_jno:int=1) -> List[WeldJoint]:
        joints:List[WeldJoint] = []
        pipe_items    = [m for m in mto_items if m.component=='PIPE']
        fitting_items = [m for m in mto_items if m.component=='FITTINGS']
        valve_items   = [m for m in mto_items if m.component=='VALVES']
        if not pipe_items: return joints

        main_dn_v = max(dn_val(p.size_dn) for p in pipe_items)
        main_pipes = [p for p in pipe_items if dn_val(p.size_dn)==main_dn_v]
        branch_pipes= [p for p in pipe_items if dn_val(p.size_dn)<main_dn_v]

        # Cut list'ten ana hat parçaları
        def safe_piece_no(c):
            try: return int(re.sub(r'[<>]','',c.piece_no))
            except: return 0
        main_cuts = sorted(
            [c for c in cut_items if dn_val(c.size_dn)==main_dn_v],
            key=safe_piece_no)

        main_fittings = [f for f in fitting_items if dn_val(f.size_dn)==main_dn_v]
        fitting_pool  = self._expand(main_fittings)
        elbow45_cuts  = self._find_45(page_text+'\n'+annot_text, main_cuts)

        jno = start_jno
        jno = self._main_seq(joints, main_pipes, main_cuts, fitting_pool,
                             elbow45_cuts, line_no, rev_no, sheet_no, jno)
        jno = self._branch_seq(joints, branch_pipes, fitting_items, valve_items,
                               line_no, rev_no, sheet_no, jno)
        return joints

    def _expand(self, fittings:list) -> list:
        pool=[]
        for f in fittings:
            try: cnt = max(1,int(float(re.sub(r'[MmFtADT]','',f.qty or '1'))))
            except: cnt=1
            for _ in range(cnt):
                pool.append({'item_no':f.item_no,'desc':f.description,
                             'dan':f.dan_code,'size_dn':f.size_dn,
                             'thk':parse_thk(f.description),
                             'is45':'45' in f.description,
                             'is90':'90' in f.description})
        return pool

    def _find_45(self, text:str, cuts:list) -> set:
        pos=set()
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if re.search(r'45[o°]',line,re.I):
                ctx='\n'.join(lines[max(0,i-3):i+4])
                for mm in re.finditer(r'<(\d+)>',ctx): pos.add(int(mm.group(1)))
        return pos

    def _pipe_node(self, pipe:MTOItem, cut:Optional[CutItem]=None) -> dict:
        return {'item_no':pipe.item_no,'desc':pipe.description,
                'dan':pipe.dan_code,'size_dn':pipe.size_dn,
                'thk':parse_thk(pipe.description),'piece':cut.piece_no if cut else ''}

    def _cont_node(self, size_dn:str, thk:str) -> dict:
        return {'item_no':'-','desc':'Continuation/Nozzle',
                'dan':'-','size_dn':size_dn,'thk':thk}

    def _main_seq(self, joints, pipes, cuts, pool, el45, ln, rv, sh, jno) -> int:
        if not pipes or not cuts: return jno
        ref = pipes[0]
        cont = self._cont_node(ref.size_dn, parse_thk(ref.description))
        p45    = [f for f in pool if f['is45']]
        p90    = [f for f in pool if f['is90'] and not f['is45']]
        p_rest = [f for f in pool if not f['is45'] and not f['is90']]
        seq=[cont]
        for i,cut in enumerate(cuts):
            seq.append(self._pipe_node(ref,cut))
            if i<len(cuts)-1:
                try: cn=int(re.sub(r'[<>]','',cut.piece_no))
                except: cn=0
                if cn in el45 and p45:   seq.append(p45.pop(0))
                elif p90:                seq.append(p90.pop(0))
                elif p_rest:             seq.append(p_rest.pop(0))
        seq.append(cont)
        for i in range(len(seq)-1):
            jno=self._add(joints,seq[i],seq[i+1],ln,rv,sh,jno)
        return jno

    def _branch_seq(self, joints, branch_pipes, fittings, valves, ln, rv, sh, jno) -> int:
        for bp in branch_pipes:
            bdv=dn_val(bp.size_dn)
            b_fits  = [f for f in fittings if dn_val(f.size_dn)==bdv]
            b_valves= [v for v in valves   if dn_val(v.size_dn)==bdv]
            seq=[]
            junc = next((f for f in b_fits
                         if re.search(r'COUPLING|TEE|SOCKOLET|WELDOLET',
                                      f.description,re.I)), None)
            if junc:
                seq.append({'item_no':junc.item_no,'desc':junc.description,
                            'dan':junc.dan_code,'size_dn':junc.size_dn,
                            'thk':parse_thk(junc.description)})
            seq.append({'item_no':bp.item_no,'desc':bp.description,
                        'dan':bp.dan_code,'size_dn':bp.size_dn,
                        'thk':parse_thk(bp.description)})
            for v in b_valves[:1]:
                seq.append({'item_no':v.item_no,'desc':v.description,
                            'dan':v.dan_code,'size_dn':v.size_dn,
                            'thk':parse_thk(v.description)})
            nip=next((f for f in b_fits if re.search(r'NIPPLE|CAP',f.description,re.I)),None)
            if nip:
                seq.append({'item_no':nip.item_no,'desc':nip.description,
                            'dan':nip.dan_code,'size_dn':nip.size_dn,
                            'thk':parse_thk(nip.description)})
            for i in range(len(seq)-1):
                jno=self._add(joints,seq[i],seq[i+1],ln,rv,sh,jno)
        return jno

    def _add(self, joints, L, R, ln, rv, sh, jno) -> int:
        joints.append(WeldJoint(
            line_no=ln, joint_no=jno, rev_no=rv, sheet_no=sh,
            item1=L.get('item_no',''), desc1=L.get('desc','')[:60],
            dan_code1=L.get('dan',''),
            size1_dn=L.get('size_dn',''), size1_mm=L.get('size_dn',''),
            size1_inch=dn_inch(L.get('size_dn','')),
            thk1_mm=L.get('thk',''),
            item2=R.get('item_no',''), desc2=R.get('desc','')[:60],
            dan_code2=R.get('dan',''),
            size2_dn=R.get('size_dn',''), size2_mm=R.get('size_dn',''),
            size2_inch=dn_inch(R.get('size_dn','')),
            thk2_mm=R.get('thk',''),
        ))
        return jno+1


# ════════════════════════════════════════════════════════
# SAYFA META
# ════════════════════════════════════════════════════════
class PageMeta:
    def __init__(self, page, page_num:int, annot_texts:List[str]):
        self.page_num   = page_num
        self.words      = page.extract_words()
        self.pw         = page.width
        self.ph         = page.height
        self.text       = page.extract_text() or ''
        self.annot_text = '\n'.join(annot_texts)
        self.full_text  = self.text + '\n' + self.annot_text
        self.line_no    = self._line_no()
        self.rev_no     = self._rev_no()
        self.sheet_no   = str(page_num)

    def _line_no(self) -> str:
        # Yöntem 1: Sayfa altı, sağ köşe (başlık bloğu)
        bot_y = self.ph * 0.85
        bot_words = [w for w in self.words
                     if w['top'] >= bot_y and w['x0'] >= self.pw*0.55]
        for w in sorted(bot_words, key=lambda x: x['top']):
            t = w['text']
            if re.match(r'^[A-Z]{2,6}-\d{2,4}-[A-Z0-9]+-[A-Z0-9]+[.\-][0-9]{3}', t, re.I):
                return t.strip()

        # Yöntem 2: Counter ile metinden en çok tekrar eden Line No
        patterns = [
            r'\b([A-Z]{2,6}-\d{2,4}-[A-Z0-9]{4,10}-[A-Z]{2}\d{2,4}[\.\-]\d{3,4}(?:[\-][A-Z0-9]+)?)\b',
            r'ДЕТАЛЬ ИЗОМЕТРИИ ТРУБЫ - ЛИНИЯ:\s*\n?\s*([A-Z0-9\-\.]+)',
            r'NEW_([A-Z]{2,3}-\d{2,4}-[A-Z0-9\-]+)',
            r'\b(FE\d{5,6})\b',
        ]
        cands=[]
        for pat in patterns:
            for m in re.finditer(pat, self.full_text, re.I|re.M):
                ln=m.group(1).strip().replace('_','.')
                if len(ln)>5 and not re.match(r'^\d+$',ln) and 'DRG' not in ln.upper():
                    cands.append(ln.upper())
        if cands: return Counter(cands).most_common(1)[0][0]
        return ''

    def _rev_no(self) -> str:
        lines = self.full_text.splitlines()
        cands=[]
        for i,line in enumerate(lines):
            # İnline: "01 GENERAL REVISION ..."
            m = re.match(r'^\s*(0[0-9]|[0-9]{2}[A-Z]?)\s+'
                         r'(?:GENERAL|ISSUED|REVISED|REVISION|ПЕРЕСМ|ВЫПУЩ)', line, re.I)
            if m: cands.append(m.group(1)); continue
            # Ayrı satır: "01\n...\nGENERAL REVISION"
            if re.search(r'GENERAL\s*REVISION|ISSUED\s*FOR|REVISED|ПЕРЕСМОТР', line, re.I):
                for j in range(max(0,i-3),i):
                    m2=re.match(r'^\s*(0[0-9]|[0-9]{2}[A-Z]?)\s*$',lines[j])
                    if m2: cands.append(m2.group(1))
        if cands:
            def rk(r): d=re.sub(r'[^0-9]','',r); return int(d) if d else 0
            return max(cands, key=rk)
        # Fallback
        m = re.search(r'\b(\d{2}[A-Z]?)\s+\d{1,2}\s+\w{3,4}\s+\d{4}',self.full_text)
        return m.group(1) if m else '00'


# ════════════════════════════════════════════════════════
# ANA EXTRACTOR
# ════════════════════════════════════════════════════════
class PipingDataExtractor:
    def __init__(self, pdf_folder:str):
        self.pdf_folder   = pdf_folder
        self.mto_wp   = MTOWordParser()
        self.mto_txt  = MTOTextParser()
        self.cut_p    = CutListParser()
        self.sup_p    = SupportParser()
        self.weld_g   = WeldLogGenerator()
        self.all_mto:      List[MTOItem]     = []
        self.all_cuts:     List[CutItem]     = []
        self.all_supports: List[SupportItem] = []
        self.all_welds:    List[WeldJoint]   = []

    def process_all(self):
        pdfs = sorted(glob.glob(os.path.join(self.pdf_folder,'*.pdf')))
        if not pdfs: print(f'⚠  PDF bulunamadı: {self.pdf_folder}'); return
        print(f'\n{"="*65}')
        print(f'  {len(pdfs)} PDF dosyası işleniyor')
        print(f'  PyMuPDF: {"✓ aktif" if HAS_MUPDF else "✗ pasif"}')
        print(f'{"="*65}')
        for p in pdfs: self._process(p)
        print(f'\n{"="*65}')
        print(f'  MTO      : {len(self.all_mto)} satır')
        print(f'  Cut List : {len(self.all_cuts)} parça')
        print(f'  Supports : {len(self.all_supports)} adet')
        print(f'  Weld Log : {len(self.all_welds)} kaynak')
        print(f'{"="*65}\n')

    def _process(self, pdf_path:str):
        fname = Path(pdf_path).name
        print(f'\n  📄 {fname}')

        # PyMuPDF ile annotation'ları önceden al
        mu_full = get_full_text_mupdf(pdf_path)
        # Sayfa bazlı annotation listesi
        page_annots:List[List[str]] = []
        if HAS_MUPDF:
            try:
                doc=fitz.open(pdf_path)
                for pg in doc:
                    pa=[a.info.get('content','').strip()
                        for a in pg.annots()
                        if a.type[1]=='FreeText' and a.info.get('content','').strip()]
                    page_annots.append(pa)
                doc.close()
            except: pass

        try:
            with pdfplumber.open(pdf_path) as pdf:
                pages=[]
                for i,p in enumerate(pdf.pages):
                    pp_text = p.extract_text() or ''
                    ann = page_annots[i] if i<len(page_annots) else []
                    # pdfplumber metin yoksa PyMuPDF ile dene
                    if not pp_text.strip() and HAS_MUPDF:
                        try:
                            doc=fitz.open(pdf_path)
                            pp_text = doc[i].get_text()
                            doc.close()
                        except: pass
                    full = (pp_text + '\n' + '\n'.join(ann)).strip()
                    if full:
                        pages.append((PageMeta(p,i+1,ann), p, full))

                if not pages: print('     ⚠  Metin yok'); return

                # Line No (birinci sayfadan)
                line_no = pages[0][0].line_no
                if not line_no:
                    stem = Path(pdf_path).stem
                    line_no = re.sub(r'[-_]B\d+$','',stem,flags=re.I).replace('_','.')
                print(f'     📋 Line No: {line_no}')

                all_mto:List[MTOItem]  = []
                all_cuts:List[CutItem] = []
                full_text = mu_full or ''

                for meta, pobj, full in pages:
                    meta.line_no = line_no

                    # ── MTO (word-position birincil, metin yedek) ──
                    mto = self.mto_wp.parse(pobj, line_no, meta.rev_no, meta.sheet_no)
                    if not mto:
                        # Yedek: metin tabanlı
                        mto = self.mto_txt.parse(full, line_no, meta.rev_no, meta.sheet_no)
                        if mto: print(f'       ✅ Sayfa {meta.sheet_no} MTO (text): {len(mto)} satır')
                    else:
                        print(f'       ✅ Sayfa {meta.sheet_no} MTO (word): {len(mto)} satır')
                    all_mto.extend(mto)

                    # ── Cut List ──
                    ann_txt = '\n'.join(page_annots[meta.page_num-1]) if (meta.page_num-1)<len(page_annots) else ''
                    cuts = self.cut_p.parse(pobj, line_no, meta.sheet_no, ann_txt)
                    all_cuts.extend(cuts)
                    if cuts: print(f'       ✅ Sayfa {meta.sheet_no} Cut: {len(cuts)} parça')

                    full_text += '\n' + full

                # Tekilleştir (aynı sheet+item)
                seen:set=set()
                dedup:List[MTOItem]=[]
                for it in all_mto:
                    k=(it.sheet_no,it.item_no)
                    if k not in seen: seen.add(k); dedup.append(it)

                # Supports
                rev_no = pages[0][0].rev_no
                sups = self.sup_p.parse(full_text, dedup, line_no, rev_no, '1')
                print(f'       ✅ Destek: {len(sups)} adet')

                # Weld Log
                gjno = len(self.all_welds)+1
                for meta, pobj, full in pages:
                    pm=[m for m in dedup   if m.sheet_no==meta.sheet_no]
                    pc=[c for c in all_cuts if c.sheet_no==meta.sheet_no]
                    if not pm: continue
                    ann_txt = '\n'.join(page_annots[meta.page_num-1]) if (meta.page_num-1)<len(page_annots) else ''
                    wj=self.weld_g.generate(
                        meta.text, pm, pc, ann_txt,
                        line_no, meta.rev_no, meta.sheet_no, gjno)
                    if wj:
                        print(f'       ✅ Sayfa {meta.sheet_no} Weld: {len(wj)} kaynak')
                        gjno+=len(wj)
                    self.all_welds.extend(wj)

                self.all_mto.extend(dedup)
                self.all_cuts.extend(all_cuts)
                self.all_supports.extend(sups)

        except Exception as e:
            print(f'     ❌ Hata: {e}')
            import traceback; traceback.print_exc()


# ════════════════════════════════════════════════════════
# EXCEL WRITER
# ════════════════════════════════════════════════════════
class ExcelWriter:
    NAVY='FF1F3864'; BLUE='FF2E75B6'; GREEN='FF375623'
    BROWN='FF7B2D00'; TEAL='FF006B6B'; WHITE='FFFFFFFF'
    ALT1='FFF2F7FB'; ALT2='FFFFFFFF'; BDR='FFB8CCE4'
    COMP_CLR={'PIPE':'FFDEEBF7','FITTINGS':'FFE2EFDA','FLANGES':'FFFCE4D6',
              'GASKETS':'FFFFF2CC','VALVES':'FFEDEDED','SUPPORTS':'FFF4B8B8',
              'INSTRUMENTS':'FFE2D9F3','BOLTS':'FFDDDDDD'}
    SUP_CLR={'Spring':'FFBDD7EE','Guide':'FFE2EFDA','Hold-Down':'FFFCE4D6',
             'Rest':'FFFFF2CC','U-Bolt':'FFEDEDED','Hanger':'FFD9D2E9',
             'Rigid':'FFFFFFFF'}

    def __init__(self):
        self.wb=Workbook(); self.wb.remove(self.wb.active)

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
              ('Size 1\nDN',10),('Size 1\nmm',10),('Size 1\nInch',10),('Thk 1\nmm',10),
              ('Item 2',8),('Desc 2',40),('DAN Code 2',22),
              ('Size 2\nDN',10),('Size 2\nmm',10),('Size 2\nInch',10),('Thk 2\nmm',10)]
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
              ('Support Ref',22),('Type',14),('Description',40),
              ('Size (DN)',10),('Quantity',10)]
        self._hdr(ws,cols,color=self.BROWN)
        for ri,it in enumerate(items,1):
            row=ri+1; af=self._af(ri)
            sf=self._fill(self.SUP_CLR.get(it.support_type,'FFFFFFFF'))
            vals=[it.line_no,it.rev_no,it.sheet_no,it.support_ref,
                  it.support_type,it.description,it.size_dn,it.quantity]
            als=['left','center','center','center','center','left','center','center']
            for ci,(v,al) in enumerate(zip(vals,als),1):
                self._dc(ws,row,ci,v,sf if ci==5 else af,al,ci==5)
        ws.auto_filter.ref=f"A1:{get_column_letter(len(cols))}1"
        print(f'  📊 Support List: {len(items)} adet')

    def write_summary(self, mto, welds, cuts, supports):
        ws=self.wb.create_sheet('OZET',0)
        ws.sheet_view.showGridLines=False
        ws.merge_cells('B2:H2')
        t=ws['B2']; t.value='BORU ÇİZİM VERİ ÇIKARMA RAPORU  v9.0'
        t.font=Font(name='Calibri',bold=True,size=16,color=self.NAVY)
        t.fill=PatternFill('solid',fgColor='FFDCE6F1')
        t.alignment=Alignment(horizontal='center',vertical='center')
        ws.row_dimensions[2].height=35

        for i,(label,cnt,color) in enumerate([
            ('MTO Satır',len(mto),self.BLUE),('Weld Kaynağı',len(welds),'FF548235'),
            ('Cut Parça',len(cuts),'FFC55A11'),('Destek',len(supports),'FF7030A0'),
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
            cc.border=Border(bottom=Side(style='medium',color=color))
            ws.row_dimensions[5].height=18; ws.row_dimensions[6].height=35

        ws.cell(row=8,column=2,value='Çizim Özeti').font=Font(name='Calibri',bold=True,size=11,color=self.NAVY)
        for ci,h in enumerate(['Line No','MTO','Cut','Destek','Weld'],2):
            c=ws.cell(row=9,column=ci,value=h)
            c.font=Font(name='Calibri',bold=True,size=9,color=self.WHITE)
            c.fill=PatternFill('solid',fgColor=self.NAVY)
            c.alignment=Alignment(horizontal='center',vertical='center')
        ws.row_dimensions[9].height=22

        sm:dict={}
        for x in mto:      sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][0]+=1
        for x in cuts:     sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][1]+=1
        for x in supports: sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][2]+=1
        for x in welds:    sm.setdefault(x.line_no,[0,0,0,0]); sm[x.line_no][3]+=1

        for ri,(ln,st) in enumerate(sorted(sm.items()),1):
            row=9+ri; af=PatternFill('solid',fgColor=self.ALT1 if ri%2 else self.ALT2)
            for ci,v in enumerate([ln]+st,2):
                c=ws.cell(row=row,column=ci,value=v)
                c.fill=af; c.font=Font(name='Calibri',size=9)
                c.alignment=Alignment(horizontal='left' if ci==2 else 'center',vertical='center')
                c.border=Border(bottom=Side(style='thin',color='FFD9D9D9'))

        for c in range(1,12): ws.column_dimensions[get_column_letter(c)].width=5
        ws.column_dimensions['B'].width=42
        for ch in 'CDEFGH': ws.column_dimensions[ch].width=14

    def save(self,path:str):
        self.wb.save(path); print(f'\n  💾 Kaydedildi: {path}')


# ════════════════════════════════════════════════════════
# GUI & ENTRY POINT
# ════════════════════════════════════════════════════════
def select_folder_gui() -> Optional[str]:
    if not HAS_TK:
        return input("PDF klasör yolu: ").strip() or None
    root=tk.Tk(); root.withdraw(); root.attributes('-topmost',True)
    folder=filedialog.askdirectory(
        title="PDF Dosyalarının Bulunduğu Klasörü Seçin",
        initialdir=os.path.expanduser('~'))
    root.destroy()
    return folder or None

def main():
    if len(sys.argv)>1:
        pdf_folder=sys.argv[1]
        out=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'Piping_Data_Compiled.xlsx')
    else:
        print("📂 PDF klasörünü seçin...")
        pdf_folder=select_folder_gui()
        if not pdf_folder or not os.path.isdir(pdf_folder):
            print("❌ Geçerli klasör seçilmedi.")
            if HAS_TK:
                try: input("Kapatmak için ENTER...")
                except: pass
            sys.exit(1)
        out=os.path.join(pdf_folder,'Piping_Data_Compiled.xlsx')

    ext=PipingDataExtractor(pdf_folder)
    ext.process_all()

    w=ExcelWriter()
    print('\n  Excel yazılıyor...')
    w.write_summary(ext.all_mto,ext.all_welds,ext.all_cuts,ext.all_supports)
    w.write_mto(ext.all_mto)
    w.write_weld_log(ext.all_welds)
    w.write_cut_list(ext.all_cuts)
    w.write_support_list(ext.all_supports)
    w.save(out)

    print('\n✅ Tamamlandı!')
    if HAS_TK:
        try:
            messagebox.showinfo('Tamamlandı',
                f'Excel oluşturuldu:\n{out}\n\n'
                f'MTO: {len(ext.all_mto)}\n'
                f'Weld Log: {len(ext.all_welds)}\n'
                f'Cut List: {len(ext.all_cuts)}\n'
                f'Supports: {len(ext.all_supports)}')
        except: pass
    try: input('\nKapatmak için ENTER...')
    except: pass

if __name__=='__main__':
    try: main()
    except KeyboardInterrupt: print('\n⏹  İptal')
    except Exception as e:
        print(f'\n❌ Kritik hata: {e}')
        import traceback; traceback.print_exc()
        try: input('Kapatmak için ENTER...')
        except: pass
        sys.exit(1)
