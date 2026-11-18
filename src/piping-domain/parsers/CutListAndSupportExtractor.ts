import { CutItem, MTOItem, PipingPageContext, SupportItem } from '../types/PipingModels';
import { detectSupportType, groupWordsIntoRows } from './MaterialNormalizer';

export class CutListExtractor {
  public extract(page: PipingPageContext, lineNo: string): CutItem[] {
    const items: CutItem[] = [];
    const seen = new Set<string>();
    const pw = page.width;
    const mtoWords = page.words.filter((w) => w.x0 >= pw * 0.67);
    const rows = groupWordsIntoRows(mtoWords, 5);

    let inCut = false;
    for (const row of rows) {
      const text = row.words.map((w) => w.text).join(' ').trim();
      if (/CUT\s*PIPE\s*LENGTH|ОТРЕЗАТЬ\s*ДЛИНУ/i.test(text)) {
        inCut = true;
        continue;
      }
      if (!inCut) continue;
      if (/^(PIECE|CUT|SIZE|REMARKS|END|NO|LENGTH|DN|PREP)/i.test(text)) continue;

      const m = text.match(
        /(<\d+>)\s+(\d+)\s+(\d{2,4})(?:\s+(PLD\s*BEND|3D\s*BEND|4D\s*BEND))?(?:\s+(BE\/BE|BE\/PE|PE\/PE|PE\/BE|TH\/BE|BE\/TH))?/i,
      );
      if (m) {
        const key = `${m[1]}__${m[3]}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            lineNo,
            sheetNo: page.sheetNo,
            pieceNo: m[1],
            length: m[2],
            sizeDn: m[3],
            remarks: (m[4] ?? '').trim(),
            endPrep: (m[5] ?? '').trim(),
          });
        }
      }
    }

    if (items.length === 0) {
      const m = page.fullText.match(/CUT\s*PIPE\s*LENGTH|ОТРЕЗАТЬ\s*ДЛИНУ/i);
      if (m && m.index !== undefined) {
        const block = page.fullText.slice(m.index + m[0].length);
        const pat =
          /<(\d+)>\s+(\d{2,6})\s+(\d{2,4})\s*(?:(PLD\s*BEND|3D\s*BEND|4D\s*BEND)\s*)?(BE\/BE|BE\/PE|PE\/PE|PE\/BE|TH\/BE|BE\/TH)?/gi;
        let rm: RegExpExecArray | null;
        while ((rm = pat.exec(block)) !== null) {
          const piece = `<${rm[1]}>`;
          const key = `${piece}__${rm[3]}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            lineNo,
            sheetNo: page.sheetNo,
            pieceNo: piece,
            length: rm[2],
            sizeDn: rm[3],
            remarks: (rm[4] ?? '').trim(),
            endPrep: (rm[5] ?? '').trim(),
          });
        }
      }
    }

    return items;
  }
}

export class SupportExtractor {
  private readonly faRef = /\b((?:FA|FE)\d{2}-[A-Z]-\d+(?:[./]\d+)?(?:\/\d+)?)\b/gi;
  private readonly spRef = /\b(SP-\d+[A-Z]?|SPS-\d+|PS-\d+)\b/gi;

  public extract(
    fullText: string,
    mtoItems: MTOItem[],
    lineNo: string,
    revNo: string,
    sheetNo: string,
  ): SupportItem[] {
    const items: SupportItem[] = [];
    const seen = new Set<string>();

    for (const m of mtoItems) {
      if (m.component !== 'SUPPORTS') continue;
      const qtyNum = Number.parseFloat(m.qty.replace(/[MmFtADT]/g, '') || '1');
      const ref = `SUP-${m.itemNo}`;
      if (!seen.has(ref)) {
        seen.add(ref);
        items.push({
          lineNo,
          revNo,
          sheetNo,
          supportRef: ref,
          supportType: detectSupportType(m.description),
          description: m.description.slice(0, 80),
          sizeDn: m.sizeDn,
          quantity: String(Number.isNaN(qtyNum) ? 1 : Math.round(qtyNum)),
        });
      }
    }

    for (const pat of [this.faRef, this.spRef]) {
      pat.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = pat.exec(fullText)) !== null) {
        const ref = mm[1].toUpperCase();
        if (!seen.has(ref)) {
          seen.add(ref);
          items.push({
            lineNo,
            revNo,
            sheetNo,
            supportRef: ref,
            supportType: 'Rigid',
            description: `Support ${ref}`,
            sizeDn: '',
            quantity: '1',
          });
        }
      }
    }

    return items;
  }
}
