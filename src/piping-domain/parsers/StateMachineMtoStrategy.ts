import { IPipingParserStrategy } from '../../core/interfaces/IPipingParserStrategy';
import { ComponentCategory, MTOItem, PipingPageContext } from '../types/PipingModels';
import { classifyComp, normDan, parseDn } from './MaterialNormalizer';

export class StateMachineMtoStrategy implements IPipingParserStrategy {
  public readonly strategyId = 'state-machine-mto';
  public readonly priority = 2;

  public canParse(page: PipingPageContext): boolean {
    return page.fullText.trim().length > 0;
  }

  public parseMTO(
    page: PipingPageContext,
    lineNo: string,
    revNo: string,
    sheetNo: string,
  ): MTOItem[] {
    const linde = this.parseLindeBom(page.fullText, lineNo, revNo, sheetNo);
    if (linde.length > 0) return linde;

    const result: MTOItem[] = [];
    const lines = page.fullText.split(/\r?\n/).map((l) => l.trim());
    let inMat = false;
    let section: ComponentCategory | '' = '';
    let ino: string | null = null;
    let descBuf: string[] = [];
    let size = '';
    let dan = '';
    let qty = '';
    let state: 'W' | 'D' | 'S' | 'Q' | 'Wt' = 'W';

    const emit = (w?: string) => {
      if (ino && descBuf.length > 0) {
        const desc = descBuf.join(' ').trim();
        const comp = section || classifyComp(desc);
        result.push({
          lineNo,
          revNo,
          sheetNo,
          itemNo: ino,
          component: comp,
          description: desc.slice(0, 120),
          sizeDn: parseDn(size),
          danCode: dan ? normDan([dan]) : '-',
          qty,
          unit: comp === 'PIPE' ? 'M' : 'ADT',
          weight: w ? w.replace(',', '.') : '0.00',
        });
      }
      ino = null;
      descBuf = [];
      size = '';
      dan = '';
      qty = '';
      state = 'W';
    };

    for (let idx = 0; idx < lines.length; idx++) {
      const s = lines[idx];
      if (!s) continue;
      if (/FABRICATION\s*MATERIALS?|ERECTION\s*MATERIALS?|МАТЕРИАЛЫ/i.test(s)) {
        emit();
        inMat = true;
        state = 'W';
        continue;
      }
      if (inMat && /TOTAL\s*(FABRICATION|ERECTION|WEIGHT)|CUT\s*PIPE|ОБЩИЙ\s*ВЕС/i.test(s)) {
        emit();
        inMat = false;
        state = 'W';
        continue;
      }
      if (!inMat) continue;

      const upper = s.toUpperCase();
      if (['PIPE', 'FITTINGS', 'FLANGES', 'GASKETS', 'VALVES', 'SUPPORTS', 'BOLTS'].includes(upper)) {
        emit();
        section = upper as ComponentCategory;
        state = 'W';
        continue;
      }

      if (state === 'W' && /^\d{1,3}$/.test(s)) {
        ino = s;
        state = 'D';
      } else if (state === 'D') {
        if (/^\d{2,4}(\s*[xX]\s*\d{1,4})?$/.test(s) && descBuf.length > 0) {
          size = s;
          state = 'S';
        } else {
          descBuf.push(s);
        }
      } else if (state === 'S') {
        if (/^\d{3}-\d{3}-\d{3}-\d{3}$/.test(s)) {
          dan = s;
          state = 'Q';
        } else if (/^\d{3}-\d{3}-\d{3}-$/.test(s)) {
          if (idx + 1 < lines.length && /^\d{3}$/.test(lines[idx + 1])) {
            dan = s + lines[++idx];
          } else {
            dan = s;
          }
          state = 'Q';
        } else if (/^[\d.]+\s*[MmFfLlTt]?$/.test(s)) {
          qty = s;
          state = 'Wt';
        }
      } else if (state === 'Q' && /^[\d.]+\s*[MmFfLlTt]?$/.test(s)) {
        qty = s;
        state = 'Wt';
      } else if (state === 'Wt' && /^[\d.,]+$/.test(s)) {
        emit(s);
      }
    }
    emit();
    return result;
  }

  private parseLindeBom(
    text: string,
    lineNo: string,
    revNo: string,
    sheetNo: string,
  ): MTOItem[] {
    const m = text.match(/POS\s+IDENT\s+NPD\s+DESCRIPTION\s+QTY/i);
    if (!m || m.index === undefined) return [];
    const block = text.slice(m.index + m[0].length);
    const items: MTOItem[] = [];
    const rowPat = /^(\d{1,2})\s+([A-Z0-9]{5,8})\s+(\d{1,2}(?:[xX]\d{1,2})?)\s+(.+?)\s+(\d+)\s*$/gm;
    let rm: RegExpExecArray | null;
    while ((rm = rowPat.exec(block)) !== null) {
      const desc = rm[4].trim();
      const comp = classifyComp(desc);
      items.push({
        lineNo,
        revNo,
        sheetNo,
        itemNo: rm[1],
        component: comp,
        description: desc.slice(0, 120),
        sizeDn: rm[3],
        danCode: rm[2],
        qty: rm[5],
        unit: comp === 'PIPE' ? 'M' : 'ADT',
        weight: '',
      });
    }
    return items;
  }
}
