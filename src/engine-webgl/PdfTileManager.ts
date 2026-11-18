import * as pdfjsLib from 'pdfjs-dist';
import { Point2D, SnapPoint } from '../core/interfaces/ICadEntity';
import { PdfBackgroundTexture } from '../core/interfaces/IRenderEngine';

export interface PdfVectorSegment {
  p1: Point2D;
  p2: Point2D;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export class PdfTileManager {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private rawBytes: Uint8Array | null = null;
  private versionCounter = 0;

  public async loadFromUrl(url: string): Promise<{ numPages: number; bytes: Uint8Array }> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch PDF (${resp.status}): ${url}`);
    const buf = await resp.arrayBuffer();
    return this.loadFromBytes(new Uint8Array(buf));
  }

  public async loadFromBytes(bytes: Uint8Array): Promise<{ numPages: number; bytes: Uint8Array }> {
    // Copy buffer because pdf.js transfers ownership to its worker
    this.rawBytes = new Uint8Array(bytes);
    const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    this.pdfDoc = await task.promise;
    return { numPages: this.pdfDoc.numPages, bytes: this.rawBytes };
  }

  public getDocument(): pdfjsLib.PDFDocumentProxy | null {
    return this.pdfDoc;
  }

  public getRawBytes(): Uint8Array | null {
    return this.rawBytes;
  }

  public async renderPageToTexture(
    pageNumber: number,
    renderScale = 2.5,
  ): Promise<{
    texture: PdfBackgroundTexture;
    vectorSnaps: SnapPoint[];
    vectorSegments: PdfVectorSegment[];
  }> {
    if (!this.pdfDoc) throw new Error('No PDF document loaded');
    const page = await this.pdfDoc.getPage(pageNumber);
    const baseVp = page.getViewport({ scale: 1.0 });
    const vp = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to create 2D context for PDF page');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const { snaps: vectorSnaps, segments: vectorSegments } = await this.extractVectorGeometry(
      page,
      baseVp.height,
    );

    this.versionCounter += 1;
    return {
      texture: {
        pageNumber,
        widthPt: baseVp.width,
        heightPt: baseVp.height,
        canvas,
        version: this.versionCounter,
      },
      vectorSnaps,
      vectorSegments,
    };
  }

  /**
   * Extracts vector line endpoints, midpoints, and segments directly from PDF operator list
   * so OSNAP and Auto-Stamp can snap precisely onto piping isometric lines!
   */
  private async extractVectorGeometry(
    page: pdfjsLib.PDFPageProxy,
    pageHeightPt: number,
  ): Promise<{ snaps: SnapPoint[]; segments: PdfVectorSegment[] }> {
    const snaps: SnapPoint[] = [];
    const segments: PdfVectorSegment[] = [];
    try {
      const ops = await page.getOperatorList();
      const OPS = pdfjsLib.OPS;
      let curX = 0;
      let curY = 0;

      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === OPS.constructPath) {
          const pathOps = ops.argsArray[i]?.[0] as number[] | undefined;
          const coords = ops.argsArray[i]?.[1] as number[] | undefined;
          if (!pathOps || !coords) continue;

          let ci = 0;
          for (const op of pathOps) {
            if (op === OPS.moveTo && ci + 1 < coords.length) {
              curX = coords[ci++];
              curY = pageHeightPt - coords[ci++];
              snaps.push({ point: { x: curX, y: curY }, kind: 'END' });
            } else if (op === OPS.lineTo && ci + 1 < coords.length) {
              const nx = coords[ci++];
              const ny = pageHeightPt - coords[ci++];
              if (Math.hypot(nx - curX, ny - curY) > 0.25) {
                segments.push({ p1: { x: curX, y: curY }, p2: { x: nx, y: ny } });
              }
              snaps.push({ point: { x: nx, y: ny }, kind: 'END' });
              snaps.push({ point: { x: (curX + nx) * 0.5, y: (curY + ny) * 0.5 }, kind: 'MID' });
              curX = nx;
              curY = ny;
            } else if (op === OPS.curveTo && ci + 5 < coords.length) {
              ci += 4;
              curX = coords[ci++];
              curY = pageHeightPt - coords[ci++];
              snaps.push({ point: { x: curX, y: curY }, kind: 'END' });
            } else if (op === OPS.rectangle && ci + 3 < coords.length) {
              const rx = coords[ci++];
              const ry = coords[ci++];
              const rw = coords[ci++];
              const rh = coords[ci++];
              const topY = pageHeightPt - (ry + rh);
              snaps.push({ point: { x: rx + rw * 0.5, y: topY + rh * 0.5 }, kind: 'CEN' });
            }
          }
          if (snaps.length > 12000) break;
        }
      }
    } catch {
      // Non-fatal if PDF has unusual path streams
    }
    return { snaps, segments };
  }
}
