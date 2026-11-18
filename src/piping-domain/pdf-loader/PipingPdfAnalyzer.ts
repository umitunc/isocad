import * as pdfjsLib from 'pdfjs-dist';
import { IPipingParserStrategy } from '../../core/interfaces/IPipingParserStrategy';
import { CutListExtractor, SupportExtractor } from '../parsers/CutListAndSupportExtractor';
import { groupWordsIntoRows } from '../parsers/MaterialNormalizer';
import { StateMachineMtoStrategy } from '../parsers/StateMachineMtoStrategy';
import { WordPositionMtoStrategy } from '../parsers/WordPositionMtoStrategy';
import { WeldTopologyBuilder } from '../topology/WeldTopologyBuilder';
import {
  ContinuationLink,
  CutItem,
  MTOItem,
  PdfWordToken,
  PipingExtractionResult,
  PipingPageContext,
  SupportItem,
  WeldJoint,
} from '../types/PipingModels';

export class PipingPdfAnalyzer {
  private readonly mtoStrategies: IPipingParserStrategy[];
  private readonly cutExtractor = new CutListExtractor();
  private readonly supportExtractor = new SupportExtractor();
  public readonly topologyBuilder = new WeldTopologyBuilder();

  constructor(strategies?: IPipingParserStrategy[]) {
    this.mtoStrategies = (
      strategies ?? [new WordPositionMtoStrategy(), new StateMachineMtoStrategy()]
    ).sort((a, b) => a.priority - b.priority);
  }

  public async analyzeDocument(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    fallbackFileName = 'ISOMETRIC',
  ): Promise<PipingExtractionResult> {
    const pages: PipingPageContext[] = [];

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const vp = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const annots = await page.getAnnotations();

      const words: PdfWordToken[] = [];
      for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const m = pdfjsLib.Util.transform(vp.transform, item.transform);
        const tx = m[4];
        const ty = m[5];
        const w = Math.max(2, item.width);
        const h = Math.max(6, Math.hypot(m[2], m[3]) || item.height || 10);
        words.push({
          text: item.str.trim(),
          x0: tx,
          x1: tx + w,
          top: ty - h,
          bottom: ty,
        });
      }

      const annotItems: Array<{ text: string; x: number; y: number; kind: 'circle' | 'triangle' }> = [];
      const annotTexts: string[] = [];
      for (const a of annots) {
        if (typeof a.contents === 'string' && a.contents.trim()) {
          const txt = a.contents.trim();
          annotTexts.push(txt);
          if (Array.isArray(a.rect) && a.rect.length === 4) {
            const cx = (a.rect[0] + a.rect[2]) * 0.5;
            const cy = vp.height - (a.rect[1] + a.rect[3]) * 0.5;
            const isTriangle = a.subtype === 'Polygon' || /field|монтаж/i.test(txt);
            annotItems.push({ text: txt, x: cx, y: cy, kind: isTriangle ? 'triangle' : 'circle' });
          }
        }
      }

      const rows = groupWordsIntoRows(words, 5);
      const text = rows.map((r) => r.words.map((w) => w.text).join(' ')).join('\n');
      const annotText = annotTexts.join('\n');
      const fullText = `${text}\n${annotText}`.trim();

      pages.push({
        pageNum: p,
        width: vp.width,
        height: vp.height,
        text,
        annotText,
        fullText,
        words,
        lineNo: this.detectLineNo(words, fullText, vp.width, vp.height),
        revNo: this.detectRevNo(fullText),
        sheetNo: String(p),
        hasDrawing: /<[0-9]+>|NS\d+|CONT\.?\s*(ON|FROM)|ПРОДОЛЖ|ИСПОЛНИТЕЛЬНЫЙ/i.test(fullText),
        hasMto:
          /FABRICATION\s*MATERIALS?|ERECTION\s*MATERIALS?|POS\s+IDENT\s+NPD|МАТЕРИАЛЫ|МОНТАЖНЫЕ|ОПИСАНИЕ\s*КОМПОНЕНТА|КОД\s*DANIELI/i.test(
            fullText,
          ),
        continuation: this.detectContinuation(fullText),
      });
      if (annotItems.length > 0) {
        (pages[pages.length - 1] as PipingPageContext & { annotItems?: typeof annotItems }).annotItems =
          annotItems;
      }
    }

    const primaryLineNo =
      pages.find((p) => p.lineNo)?.lineNo ||
      fallbackFileName.replace(/\.pdf$/i, '').replace(/[-_]B\d+$/i, '').toUpperCase();
    const primaryRevNo = pages[0]?.revNo || '00';

    const allMto: MTOItem[] = [];
    const allCuts: CutItem[] = [];
    const seenMto = new Set<string>();

    for (const pg of pages) {
      pg.lineNo = primaryLineNo;
      let pageMto: MTOItem[] = [];
      for (const strat of this.mtoStrategies) {
        if (!strat.canParse(pg)) continue;
        pageMto = strat.parseMTO(pg, primaryLineNo, pg.revNo, pg.sheetNo);
        if (pageMto.length > 0) break;
      }

      for (const it of pageMto) {
        const key = `${it.sheetNo}__${it.itemNo}`;
        if (!seenMto.has(key)) {
          seenMto.add(key);
          allMto.push(it);
        }
      }

      const cuts = this.cutExtractor.extract(pg, primaryLineNo);
      allCuts.push(...cuts);
    }

    const combinedText = pages.map((p) => p.fullText).join('\n');
    const supports: SupportItem[] = this.supportExtractor.extract(
      combinedText,
      allMto,
      primaryLineNo,
      primaryRevNo,
      '1',
    );

    const welds: WeldJoint[] = [];
    let jno = 1;
    for (const pg of pages) {
      const pm = allMto.filter((m) => m.sheetNo === pg.sheetNo);
      const pc = allCuts.filter((c) => c.sheetNo === pg.sheetNo);
      if (pm.length === 0 || pc.length === 0) continue;
      const pageWelds = this.topologyBuilder.build(pg, pm, pc, primaryLineNo, pg.revNo, jno);
      jno += pageWelds.length;
      welds.push(...pageWelds);
    }

    // Multi-page fallback: MTO on page 1 and Cut List on page 2+ (e.g. GN-400)
    if (welds.length === 0 && allMto.length > 0 && allCuts.length > 0 && pages[0]) {
      const mergedWelds = this.topologyBuilder.build(
        pages[0],
        allMto,
        allCuts,
        primaryLineNo,
        primaryRevNo,
        1,
      );
      welds.push(...mergedWelds);
    }

    // As-Built PDF fallback (e.g. CGG-800-AH01PG-FA00.520-HC without MTO table)
    if (welds.length === 0) {
      let ajno = 1;
      const seenJoints = new Set<string>();
      for (const pg of pages) {
        const pgWithAnnots = pg as PipingPageContext & {
          annotItems?: Array<{ text: string; x: number; y: number; kind: 'circle' | 'triangle' }>;
        };
        if (pgWithAnnots.annotItems) {
          for (const item of pgWithAnnots.annotItems) {
            const lines = item.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            if (lines.length === 0) continue;
            const jointLabel = lines[0];
            const welderLabel = lines.slice(1).join(' / ');
            if (!/^\d{1,3}[A-Z]?\d?$/i.test(jointLabel)) continue;
            seenJoints.add(jointLabel);
            welds.push({
              lineNo: primaryLineNo,
              jointNo: ajno++,
              revNo: pg.revNo,
              sheetNo: pg.sheetNo,
              item1: jointLabel,
              desc1: welderLabel ? `Welder: ${welderLabel}` : 'As-Built Weld Stamp',
              danCode1: '-',
              size1Dn: primaryLineNo.match(/-(\d{2,4})-/)?.[1] ?? '',
              size1Mm: primaryLineNo.match(/-(\d{2,4})-/)?.[1] ?? '',
              size1Inch: '',
              thk1Mm: '',
              item2: '-',
              desc2: 'Pipe / Fitting',
              danCode2: '-',
              size2Dn: '',
              size2Mm: '',
              size2Inch: '',
              thk2Mm: '',
              anchorWorld: { x: item.x, y: item.y },
            });
          }
        }

        // Also scan spatial word tokens for stamped Joint + Welder pairs (e.g. "2R1 9040 8A2T", "19 ER0Z", "22 B612")
        if (welds.length === 0) {
          const stampPat = /\b(\d{1,2}(?:R\d)?)\s+([A-Z0-9]{4})(?:\s+(8A2T|EK62|A7RX|A2HP|AF6A|[A-Z0-9]{4}))?\b/g;
          let sm: RegExpExecArray | null;
          while ((sm = stampPat.exec(pg.fullText)) !== null) {
            const jLabel = sm[1];
            const w1 = sm[2];
            const w2 = sm[3] ?? '';
            // Filter out year/date false positives like "2024" or "1251"
            if (/^\d{4}$/.test(w1) && !w2 && w1 !== '9040') continue;
            if (/^(?:EL|NS|DN|FE|FA|RV|CG)/i.test(w1)) continue;
            if (seenJoints.has(jLabel)) continue;
            seenJoints.add(jLabel);

            const tok = pg.words.find((w) => w.text.trim() === jLabel);
            welds.push({
              lineNo: primaryLineNo,
              jointNo: ajno++,
              revNo: pg.revNo,
              sheetNo: pg.sheetNo,
              item1: jLabel,
              desc1: `Welder: ${w2 ? `${w1} / ${w2}` : w1}`,
              danCode1: '-',
              size1Dn: primaryLineNo.match(/-(\d{2,4})-/)?.[1] ?? '',
              size1Mm: primaryLineNo.match(/-(\d{2,4})-/)?.[1] ?? '',
              size1Inch: '',
              thk1Mm: '',
              item2: '-',
              desc2: 'As-Built Weld Stamp',
              danCode2: '-',
              size2Dn: '',
              size2Mm: '',
              size2Inch: '',
              thk2Mm: '',
              anchorWorld: tok ? { x: (tok.x0 + tok.x1) * 0.5, y: (tok.top + tok.bottom) * 0.5 } : undefined,
            });
          }
        }
      }
    }

    return {
      lineNo: primaryLineNo,
      revNo: primaryRevNo,
      pages,
      mto: allMto,
      cuts: allCuts,
      supports,
      welds,
    };
  }

  private detectLineNo(
    words: PdfWordToken[],
    fullText: string,
    pw: number,
    ph: number,
  ): string {
    const botWords = words
      .filter((w) => w.top >= ph * 0.85 && w.x0 >= pw * 0.55)
      .sort((a, b) => a.top - b.top);
    for (const w of botWords) {
      if (/^[A-Z]{2,6}-\d{2,4}-[A-Z0-9]+-[A-Z0-9]+[.\-]\d{3}/i.test(w.text)) {
        return w.text.trim().toUpperCase();
      }
    }
    const m = fullText.match(
      /\b([A-Z]{2,6}-\d{2,4}-[A-Z0-9]{4,10}-[A-Z]{2}\d{2,4}[.\-]\d{3,4}(?:-[A-Z0-9]+)?)\b/i,
    );
    return m ? m[1].toUpperCase() : '';
  }

  private detectRevNo(text: string): string {
    const matches = [...text.matchAll(/\b(\d{2}[A-Z]?)\s+\d{1,2}\s+\w{3,4}\s+\d{4}/g)];
    if (matches.length > 0) return matches[matches.length - 1][1];
    return '00';
  }

  private detectContinuation(text: string): ContinuationLink | null {
    const mOn = text.match(/CONT\.?\s*ON\s+([A-Z0-9.\-]+)/i);
    if (mOn) return { type: 'ON', target: mOn[1] };
    const mFrom = text.match(/CONT\.?\s*FROM\s+([A-Z0-9.\-]+)/i);
    if (mFrom) return { type: 'FROM', target: mFrom[1] };
    return null;
  }
}
