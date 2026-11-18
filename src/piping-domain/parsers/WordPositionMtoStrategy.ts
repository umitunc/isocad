import { IPipingParserStrategy } from '../../core/interfaces/IPipingParserStrategy';
import { ComponentCategory, MTOItem, PdfWordToken, PipingPageContext } from '../types/PipingModels';
import { classifyComp, groupWordsIntoRows, normDan, parseDn } from './MaterialNormalizer';

type ColRanges = Record<'item' | 'desc' | 'size' | 'dan' | 'qty' | 'weight', [number, number]>;

const DANIELI_COLS: ColRanges = {
  item: [0.715, 0.733],
  desc: [0.733, 0.852],
  size: [0.852, 0.883],
  dan: [0.883, 0.921],
  qty: [0.921, 0.952],
  weight: [0.952, 1.001],
};

const LINDE_COLS: ColRanges = {
  item: [0.78, 0.83],
  desc: [0.83, 0.9],
  size: [0.9, 0.93],
  dan: [0.93, 0.96],
  qty: [0.96, 0.985],
  weight: [0.985, 1.001],
};

const SECTION_MAP: Record<string, ComponentCategory> = {
  PIPE: 'PIPE',
  FITTINGS: 'FITTINGS',
  FLANGES: 'FLANGES',
  GASKETS: 'GASKETS',
  VALVES: 'VALVES',
  'VALVES/IN-LINEITEMS': 'VALVES',
  SUPPORTS: 'SUPPORTS',
  INSTRUMENTS: 'INSTRUMENTS',
  BOLTS: 'BOLTS',
  ТРУБА: 'PIPE',
  ФИТИНГИ: 'FITTINGS',
  ФЛАНЦЫ: 'FLANGES',
  ПРОКЛАДКИ: 'GASKETS',
  КЛАПАНЫ: 'VALVES',
  'КЛАПАНЫ/ЭЛЕМЕНТЫНАСОПРОВОДЕ': 'VALVES',
  ОПОРЫ: 'SUPPORTS',
  ПРИБОРЫ: 'INSTRUMENTS',
};

export class WordPositionMtoStrategy implements IPipingParserStrategy {
  public readonly strategyId = 'word-position-mto';
  public readonly priority = 1;

  public canParse(page: PipingPageContext): boolean {
    return page.words.length > 0;
  }

  public parseMTO(
    page: PipingPageContext,
    lineNo: string,
    revNo: string,
    sheetNo: string,
  ): MTOItem[] {
    const pw = page.width;
    const cols = pw < 1500 ? LINDE_COLS : DANIELI_COLS;
    const threshold = Math.min(...Object.values(cols).map((c) => c[0])) - 0.02;
    const mtoWords = page.words.filter((w) => w.x0 >= pw * threshold);
    if (mtoWords.length === 0) return [];

    const rows = groupWordsIntoRows(mtoWords, 5);
    const items: MTOItem[] = [];
    let inFab = false;
    let inErect = false;
    let curSec: ComponentCategory | '' = '';
    let cur: {
      itemNo: string;
      descParts: string[];
      size: string;
      danRaw: string[];
      qty: string;
      weight: string;
    } | null = null;

    const flush = () => {
      if (!cur) return;
      const desc = cur.descParts.join(' ').replace(/\s+/g, ' ').trim();
      if (
        desc &&
        !['PIPE', 'FITTINGS', 'FLANGES', 'GASKETS', 'VALVES', 'SUPPORTS', 'BOLTS'].includes(
          desc.toUpperCase(),
        )
      ) {
        const comp = curSec || classifyComp(desc);
        let qty = cur.qty.trim();
        let wt = cur.weight.trim();
        if (!qty && wt) {
          const parts = wt.split(/\s+/);
          if (parts.length >= 2) {
            qty = parts[parts.length - 2];
            wt = parts[parts.length - 1];
          }
        }
        items.push({
          lineNo,
          revNo,
          sheetNo,
          itemNo: cur.itemNo,
          component: comp,
          description: desc.slice(0, 120),
          sizeDn: parseDn(cur.size),
          danCode: normDan(cur.danRaw),
          qty,
          unit: comp === 'PIPE' ? 'M' : 'ADT',
          weight: wt,
        });
      }
      cur = null;
    };

    for (const row of rows) {
      const text = row.words.map((w) => w.text).join(' ').trim();
      const txtClean = text.replace(/\s+/g, '').toUpperCase();

      if (
        /^(ITEM|COMPONENT|DESCRIPTION|SIZE|DAN\s*CODE|QTY|WEIGHT|\(DN\)|\(Kg\)|ПОЗИ|ЦИЯ|ОПИСАНИЕ|РАЗМЕР|КОЛИЧЕСТ|PT\s*NO|N\.S\.)/i.test(
          text,
        )
      ) {
        continue;
      }

      if (/FABRICATION\s*MATERIALS?|МАТЕРИАЛЫ\s*ДЛЯ\s*ИЗГОТОВЛЕНИЯ/i.test(text)) {
        flush();
        inFab = true;
        inErect = false;
        continue;
      }
      if (/ERECTION\s*MATERIALS?|МОНТАЖНЫЕ\s*МАТЕРИАЛЫ/i.test(text)) {
        flush();
        inErect = true;
        inFab = false;
        continue;
      }

      const sec = SECTION_MAP[txtClean];
      if (sec) {
        flush();
        if (!inFab && !inErect) inFab = true;
        curSec = sec;
        continue;
      }

      if (!inFab && !inErect) continue;

      if (/TOTAL\s*(FAB|ERECT|WEIGHT)|ОБЩИЙ\s*ВЕС|TOTALWEIGHT/i.test(text)) {
        flush();
        if (text.toUpperCase().includes('TOTAL WEIGHT') || text.includes('ОБЩИЙ ВЕС')) {
          inFab = false;
          inErect = false;
        }
        continue;
      }

      const c = this.splitCols(row.words, pw, cols);
      const itemT = c.item.trim();
      const descT = c.desc.trim();
      const sizeT = c.size.trim();
      const danT = c.dan.trim();
      const qtyT = c.qty.trim();
      const wtT = c.weight.trim();

      if (danT && /^\d{1,4}$/.test(danT) && cur && !itemT) {
        cur.danRaw.push(danT);
        if (descT) cur.descParts.push(descT);
        continue;
      }

      if (/^\d{1,3}$/.test(itemT) && descT) {
        flush();
        cur = {
          itemNo: itemT,
          descParts: [descT],
          size: sizeT,
          danRaw: danT ? [danT] : [],
          qty: qtyT,
          weight: wtT,
        };
      } else if (cur && (descT || danT || qtyT || wtT)) {
        if (descT) cur.descParts.push(descT);
        if (danT) cur.danRaw.push(danT);
        if (!cur.qty && qtyT) cur.qty = qtyT;
        if (!cur.weight && wtT) cur.weight = wtT;
        if (!cur.size && sizeT) cur.size = sizeT;
      }
    }

    flush();
    return items;
  }

  private splitCols(rw: PdfWordToken[], pw: number, cols: ColRanges): Record<keyof ColRanges, string> {
    const out: Record<keyof ColRanges, string> = {
      item: '',
      desc: '',
      size: '',
      dan: '',
      qty: '',
      weight: '',
    };
    const keys = Object.keys(cols) as Array<keyof ColRanges>;
    for (const w of rw) {
      const rel = w.x0 / pw;
      let matched = false;
      for (const k of keys) {
        const [lo, hi] = cols[k];
        if (rel >= lo && rel < hi) {
          out[k] = `${out[k]} ${w.text}`.trim();
          matched = true;
          break;
        }
      }
      if (!matched) {
        let best = keys[0];
        let bestDist = Infinity;
        for (const k of keys) {
          const mid = (cols[k][0] + cols[k][1]) * 0.5;
          const d = Math.abs(rel - mid);
          if (d < bestDist) {
            bestDist = d;
            best = k;
          }
        }
        out[best] = `${out[best]} ${w.text}`.trim();
      }
    }
    return out;
  }
}
