import ExcelJS from 'exceljs';
import { ExportArtifact, ExportContext, IExporter } from '../core/interfaces/IExporter';

const COMP_COLORS: Record<string, string> = {
  PIPE: 'FFDEEBF7',
  FITTINGS: 'FFE2EFDA',
  FLANGES: 'FFFCE4D6',
  GASKETS: 'FFFFF2CC',
  VALVES: 'FFEDEDED',
  SUPPORTS: 'FFF4B8B8',
  INSTRUMENTS: 'FFE2D9F3',
  BOLTS: 'FFDDDDDD',
};

export class ExcelWorkbookExporter implements IExporter {
  public readonly formatId = 'xlsx';
  public readonly label = '5-Sheet Engineering Excel (.xlsx)';

  public async export(context: ExportContext): Promise<ExportArtifact> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'IsoCad Piping Intelligence';
    const { mto, welds, cuts, supports } = context.pipingData;

    // 1. OZET
    const wsSummary = wb.addWorksheet('OZET', { views: [{ showGridLines: false }] });
    wsSummary.mergeCells('B2:G2');
    const titleCell = wsSummary.getCell('B2');
    titleCell.value = `ISOCAD PIPING ISOMETRIC REPORT — ${context.drawingNo}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F3864' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(2).height = 32;

    const kpis: Array<[string, number, string]> = [
      ['MTO Rows', mto.length, 'FF2E75B6'],
      ['Weld Joints', welds.length, 'FF548235'],
      ['Cut Pieces', cuts.length, 'FFC55A11'],
      ['Supports', supports.length, 'FF7030A0'],
    ];
    kpis.forEach(([label, count, color], idx) => {
      const col = 2 + idx;
      const lc = wsSummary.getCell(4, col);
      lc.value = label;
      lc.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      lc.alignment = { horizontal: 'center', vertical: 'middle' };

      const vc = wsSummary.getCell(5, col);
      vc.value = count;
      vc.font = { name: 'Calibri', bold: true, size: 16, color: { argb: color } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' };
      wsSummary.getColumn(col).width = 22;
    });

    // 2. MTO
    const wsMto = wb.addWorksheet('MTO', { views: [{ state: 'frozen', ySplit: 1 }] });
    const mtoCols = [
      'Line No', 'Rev No', 'Sheet No', 'Item No', 'Component',
      'Description', 'Size (DN)', 'DAN Code', 'Qty', 'Unit', 'Weight (Kg)',
    ];
    this.applyHeader(wsMto, mtoCols, 'FF1F3864', [30, 8, 8, 8, 14, 52, 10, 20, 10, 8, 12]);
    mto.forEach((it, idx) => {
      const r = wsMto.addRow([
        it.lineNo, it.revNo, it.sheetNo, it.itemNo, it.component,
        it.description, it.sizeDn, it.danCode, it.qty, it.unit, it.weight,
      ]);
      const bg = idx % 2 === 0 ? 'FFF2F7FB' : 'FFFFFFFF';
      r.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 9, bold: colNum === 5 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colNum === 5 ? (COMP_COLORS[it.component] ?? 'FFECF0F1') : bg },
        };
      });
    });

    // 3. Weld_Log
    const wsWeld = wb.addWorksheet('Weld_Log', { views: [{ state: 'frozen', ySplit: 1 }] });
    const weldCols = [
      'Line No', 'Joint No', 'Rev No', 'Sheet No',
      'Item 1', 'Desc 1', 'DAN Code 1', 'Size 1 DN', 'Size 1 Inch', 'Thk 1 mm',
      'Item 2', 'Desc 2', 'DAN Code 2', 'Size 2 DN', 'Size 2 Inch', 'Thk 2 mm',
    ];
    this.applyHeader(wsWeld, weldCols, 'FF006B6B', [28, 10, 8, 8, 8, 36, 18, 10, 10, 10, 8, 36, 18, 10, 10, 10]);
    welds.forEach((w) => {
      wsWeld.addRow([
        w.lineNo, w.jointNo, w.revNo, w.sheetNo,
        w.item1, w.desc1, w.danCode1, w.size1Dn, w.size1Inch, w.thk1Mm,
        w.item2, w.desc2, w.danCode2, w.size2Dn, w.size2Inch, w.thk2Mm,
      ]);
    });

    // 4. Cut_List
    const wsCut = wb.addWorksheet('Cut_List', { views: [{ state: 'frozen', ySplit: 1 }] });
    this.applyHeader(
      wsCut,
      ['Line No', 'Sheet No', 'Piece No', 'Length (mm)', 'Size (DN)', 'End Prep', 'Remarks'],
      'FF375623',
      [30, 10, 10, 14, 12, 12, 22],
    );
    cuts.forEach((c) => {
      wsCut.addRow([c.lineNo, c.sheetNo, c.pieceNo, c.length, c.sizeDn, c.endPrep, c.remarks]);
    });

    // 5. Support_List
    const wsSup = wb.addWorksheet('Support_List', { views: [{ state: 'frozen', ySplit: 1 }] });
    this.applyHeader(
      wsSup,
      ['Line No', 'Rev No', 'Sheet No', 'Support Ref', 'Type', 'Description', 'Size (DN)', 'Qty'],
      'FF7B2D00',
      [30, 8, 8, 20, 14, 38, 10, 10],
    );
    supports.forEach((s) => {
      wsSup.addRow([s.lineNo, s.revNo, s.sheetNo, s.supportRef, s.supportType, s.description, s.sizeDn, s.quantity]);
    });

    const buffer = await wb.xlsx.writeBuffer();
    return {
      blob: new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename: `${context.drawingNo || 'Piping_Data'}_Compiled.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private applyHeader(ws: ExcelJS.Worksheet, headers: string[], argb: string, widths: number[]): void {
    const row = ws.addRow(headers);
    row.height = 26;
    row.eachCell((cell, i) => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      ws.getColumn(i).width = widths[i - 1] ?? 15;
    });
  }
}
