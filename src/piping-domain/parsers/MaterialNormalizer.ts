import { ComponentCategory, PdfWordToken, SupportItem } from '../types/PipingModels';

export const DN_TO_INCH: Record<number, string> = {
  15: '1/2"',
  20: '3/4"',
  25: '1"',
  32: '1-1/4"',
  40: '1-1/2"',
  50: '2"',
  65: '2-1/2"',
  80: '3"',
  100: '4"',
  125: '5"',
  150: '6"',
  200: '8"',
  250: '10"',
  300: '12"',
  350: '14"',
  400: '16"',
  450: '18"',
  500: '20"',
  600: '24"',
  700: '28"',
  800: '32"',
  900: '36"',
  1000: '40"',
  1200: '48"',
};

export const COMP_KEYWORDS: Record<ComponentCategory, string[]> = {
  PIPE: ['PIPE', 'ТРУБА'],
  FLANGES: ['FLANGE', 'ФЛАНЕЦ', 'ФЛАНЦЫ', 'SW-FLANGE'],
  GASKETS: ['GASKET', 'ПРОКЛАДКА', 'УПЛОТНЕНИЕ'],
  VALVES: ['VALVE', 'КЛАПАН', 'ЗАДВИЖКА', 'BUTTERFLY', 'GATE', 'GLOBE', 'BALL', 'CHECK', 'ЗАТВОР'],
  FITTINGS: [
    'ELBOW', 'TEE', 'REDUCER', 'COUPLING', 'CAP', 'NIPPLE', 'WELDOLET', 'SOCKOLET',
    'SPECTACLE', 'SPACER', 'OBSTRUCTION', 'КОЛЕНО', 'ТРОЙНИК', 'ПЕРЕХОД', 'МУФТА', 'ЗАГЛУШКА',
  ],
  SUPPORTS: ['SUPPORT', 'HANGER', 'U-BOLT', 'REST', 'GUIDE', 'SPRING', 'HOLD', 'ОПОРА', 'U-БОЛ'],
  INSTRUMENTS: ['INSTRUMENT', 'INDICATOR', 'TRANSMITTER', 'ПРИБОРЫ', 'FA00-', 'FE21-'],
  BOLTS: ['BOLT', 'NUT', 'STUD'],
};

export function dnToInch(dn: string): string {
  const clean = String(dn || '').split(/[xX]/)[0].trim();
  const v = Number.parseInt(clean, 10);
  if (Number.isNaN(v) || v <= 0) return dn || '';
  return DN_TO_INCH[v] ?? `${(v / 25.4).toFixed(2)}"`;
}

export function parseDn(s: string): string {
  const m = String(s || '').trim().match(/^(\d+)/);
  return m ? m[1] : String(s || '').trim();
}

export function dnVal(s: string): number {
  const clean = String(s || '').split(/[xX]/)[0].trim();
  const v = Number.parseInt(clean, 10);
  return Number.isNaN(v) ? 0 : v;
}

export function parseThk(desc: string): string {
  const m1 = String(desc).match(/[Tt]hk\.?\s*(\d+[.,]\d+)\s*mm/);
  if (m1) return m1[1].replace(',', '.');
  const m2 = String(desc).match(/Толщина\s+(\d+[.,]\d+)\s*mm/);
  return m2 ? m2[1].replace(',', '.') : '';
}

export function normDan(parts: string[]): string {
  let combined = parts.join('').replace(/\s+/g, '').replace(/-+/g, '-').replace(/-$/, '');
  if (/^\d{3}-\d{3}-\d{3}-\d{3}$/.test(combined)) return combined;
  const digits = combined.replace(/-/g, '');
  if (digits.length === 12 && /^\d+$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  const m = combined.match(/^(\d{3}-\d{3}-\d{3})-?(\d{1,3})?$/);
  if (m) return `${m[1]}-${(m[2] ?? '').padStart(3, '0')}`;
  if (/^0\.\d{5,7}\.[A-Z]$/.test(combined)) return combined;
  return combined || '-';
}

export function classifyComp(desc: string): ComponentCategory {
  const up = desc.toUpperCase();
  for (const [cat, kws] of Object.entries(COMP_KEYWORDS) as Array<[ComponentCategory, string[]]>) {
    if (kws.some((k) => up.includes(k.toUpperCase()))) {
      return cat;
    }
  }
  return 'FITTINGS';
}

export function detectSupportType(desc: string): SupportItem['supportType'] {
  const u = desc.toUpperCase();
  if (u.includes('SPRING')) return 'Spring';
  if (u.includes('GUIDE')) return 'Guide';
  if (u.includes('HOLD') || u.includes('AXIAL')) return 'Hold-Down';
  if (u.includes('REST')) return 'Rest';
  if (u.includes('U-BOLT') || u.includes('U-БОЛ')) return 'U-Bolt';
  if (u.includes('HANGER')) return 'Hanger';
  return 'Rigid';
}

export function groupWordsIntoRows(
  words: PdfWordToken[],
  tol = 5,
): Array<{ y: number; words: PdfWordToken[] }> {
  if (words.length === 0) return [];
  const sorted = [...words].sort((a, b) => a.top - b.top);
  const rows: Array<{ y: number; words: PdfWordToken[] }> = [];
  let cy = sorted[0].top;
  let cr: PdfWordToken[] = [];

  for (const w of sorted) {
    if (Math.abs(w.top - cy) <= tol) {
      cr.push(w);
    } else {
      rows.push({ y: cy, words: cr.sort((a, b) => a.x0 - b.x0) });
      cr = [w];
      cy = w.top;
    }
  }
  if (cr.length > 0) {
    rows.push({ y: cy, words: cr.sort((a, b) => a.x0 - b.x0) });
  }
  return rows;
}
