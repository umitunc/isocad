import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DimensionEntity } from '../core/entities/DimensionEntity';
import { TextEntity } from '../core/entities/TextEntity';
import { WeldStampEntity } from '../core/entities/WeldStampEntity';
import { ExportArtifact, ExportContext, IExporter } from '../core/interfaces/IExporter';
import { hexToRgba } from '../core/math/GeometryIntersections';

export class PdfVectorExporter implements IExporter {
  public readonly formatId = 'pdf';
  public readonly label = 'Vector PDF (pdf-lib)';

  public async export(context: ExportContext): Promise<ExportArtifact> {
    const pdfDoc = context.originalPdfBytes
      ? await PDFDocument.load(context.originalPdfBytes)
      : await PDFDocument.create();

    if (pdfDoc.getPageCount() === 0) {
      const dims = context.pageDimensionsPt[0] ?? { width: 1191, height: 842 };
      pdfDoc.addPage([dims.width, dims.height]);
    }

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageNumber = pageIdx + 1;
      const { height } = page.getSize();
      const pageEntities = context.entities.filter((e) => e.visible && e.pageNumber === pageNumber);

      for (const ent of pageEntities) {
        const lines = ent.toRenderPrimitives(false, false);
        for (const l of lines) {
          page.drawLine({
            start: { x: l.x1, y: height - l.y1 },
            end: { x: l.x2, y: height - l.y2 },
            thickness: Math.max(0.75, l.width * 0.75),
            color: rgb(l.colorRgba[0], l.colorRgba[1], l.colorRgba[2]),
            opacity: l.colorRgba[3],
          });
        }

        const [r, g, b] = hexToRgba(ent.strokeColor, 1);
        const col = rgb(r, g, b);

        if (ent instanceof WeldStampEntity) {
          const primary = ent.getPrimaryLabel();
          const secondary = ent.getSecondaryLabel();
          const fSize = Math.max(7, Math.min(12, Math.min(ent.width, ent.height) * 0.24));
          const cx = ent.center.x;
          const cy = height - ent.center.y;

          if (secondary) {
            const pW = fontBold.widthOfTextAtSize(primary, fSize);
            const sW = fontBold.widthOfTextAtSize(secondary, fSize * 0.85);
            page.drawText(primary, { x: cx - pW * 0.5, y: cy + fSize * 0.35, size: fSize, font: fontBold, color: col });
            page.drawText(secondary, {
              x: cx - sW * 0.5,
              y: cy - fSize * 0.95,
              size: fSize * 0.85,
              font: fontBold,
              color: col,
            });
          } else {
            const pW = fontBold.widthOfTextAtSize(primary, fSize);
            page.drawText(primary, { x: cx - pW * 0.5, y: cy - fSize * 0.3, size: fSize, font: fontBold, color: col });
          }
        } else if (ent instanceof DimensionEntity) {
          const { mid } = ent.getDimensionLinePoints();
          const label = `${Math.round(ent.getMeasuredMm())} mm`;
          page.drawText(label, {
            x: mid.x - 16,
            y: height - mid.y + 4,
            size: 8,
            font: fontBold,
            color: col,
          });
        } else if (ent instanceof TextEntity) {
          page.drawText(ent.text, {
            x: ent.position.x,
            y: height - ent.position.y,
            size: Math.max(8, ent.fontSize * 0.8),
            font: fontBold,
            color: col,
          });
        }
      }
    }

    // Embed lossless QCad project metadata inside the PDF for round-trip re-editing
    const metaPayload = JSON.stringify({
      qcadVersion: '1.0.0',
      drawingNo: context.drawingNo,
      revisionNo: context.revisionNo,
      entities: context.entities.map((e) => e.serialize()),
    });
    await pdfDoc.attach(new TextEncoder().encode(metaPayload), 'isocad-weldmap.json', {
      mimeType: 'application/json',
      description: 'IsoCad Vector CAD & Piping Weldmap State',
    });

    pdfDoc.setProducer('IsoCad WebGL2 Industrial PDF Editor');
    const outBytes = await pdfDoc.save();
    return {
      blob: new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }),
      filename: `${context.drawingNo || 'drawing'}_isocad_rev${context.revisionNo || '01'}.pdf`,
      mimeType: 'application/pdf',
    };
  }
}
