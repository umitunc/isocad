import { DimensionEntity } from '../core/entities/DimensionEntity';
import { TextEntity } from '../core/entities/TextEntity';
import { WeldStampEntity } from '../core/entities/WeldStampEntity';
import { BoundingBox, ICadEntity, Point2D, SnapPoint } from '../core/interfaces/ICadEntity';
import { ViewportTransform } from '../core/interfaces/IRenderEngine';
import { worldToScreen } from '../core/math/Mat3Camera';

export interface HudOverlayState {
  viewport: ViewportTransform;
  entities: ICadEntity[];
  selectedIds: Set<string>;
  snapIndicator: SnapPoint | null;
  marqueeBox: { start: Point2D; current: Point2D; isCrossing: boolean } | null;
  pageDimensionsPt: { width: number; height: number } | null;
  showRulers: boolean;
}

export class TextAndHudOverlay {
  private ctx: CanvasRenderingContext2D | null = null;
  private cssW = 800;
  private cssH = 600;
  private dpr = 1;

  public mount(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d');
  }

  public resize(canvas: HTMLCanvasElement, widthCss: number, heightCss: number, dpr: number): void {
    this.cssW = Math.max(1, widthCss);
    this.cssH = Math.max(1, heightCss);
    this.dpr = Math.max(1, dpr);
    canvas.width = Math.round(this.cssW * this.dpr);
    canvas.height = Math.round(this.cssH * this.dpr);
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  public render(state: HudOverlayState): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.cssW, this.cssH);

    // 1. Crisp Stamp Labels, Dimension Measurements, and Free Text
    for (const ent of state.entities) {
      if (!ent.visible) continue;
      if (ent instanceof WeldStampEntity) {
        this.drawWeldStampLabels(ctx, ent, state.viewport);
      } else if (ent instanceof DimensionEntity) {
        this.drawDimensionText(ctx, ent, state.viewport);
      } else if (ent instanceof TextEntity) {
        this.drawFreeText(ctx, ent, state.viewport);
      }
    }

    // 1.5 Selection Grips for WeldStampEntity leader anchor endpoints
    if (state.selectedIds.size > 0) {
      for (const ent of state.entities) {
        if (
          ent instanceof WeldStampEntity &&
          ent.visible &&
          ent.hasLeader &&
          state.selectedIds.has(ent.id)
        ) {
          this.drawSelectionGrip(ctx, ent.leaderAnchor, state.viewport);
        }
      }
    }

    // 2. Selection Box (AutoCAD Blue Window vs Green Crossing)
    if (state.marqueeBox) {
      const s1 = worldToScreen(state.marqueeBox.start, state.viewport);
      const s2 = worldToScreen(state.marqueeBox.current, state.viewport);
      const x = Math.min(s1.x, s2.x);
      const y = Math.min(s1.y, s2.y);
      const w = Math.abs(s2.x - s1.x);
      const h = Math.abs(s2.y - s1.y);
      ctx.save();
      if (state.marqueeBox.isCrossing) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.14)';
        ctx.strokeStyle = '#22c55e';
        ctx.setLineDash([5, 4]);
      } else {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.strokeStyle = '#38bdf8';
      }
      ctx.lineWidth = 1.25;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // 3. OSNAP Marker
    if (state.snapIndicator) {
      this.drawSnapIndicator(ctx, state.snapIndicator, state.viewport);
    }

    // 4. Industrial Millimeter & Sheet Grid Rulers
    if (state.showRulers) {
      this.drawRulers(ctx, state.viewport, state.pageDimensionsPt);
    }
  }

  private drawSelectionGrip(
    ctx: CanvasRenderingContext2D,
    worldPt: Point2D,
    vp: ViewportTransform,
  ): void {
    const s = worldToScreen(worldPt, vp);
    const size = 9;
    const half = size * 0.5;
    ctx.save();
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(s.x - half, s.y - half, size, size);
    ctx.strokeRect(s.x - half, s.y - half, size, size);
    ctx.restore();
  }

  private drawWeldStampLabels(
    ctx: CanvasRenderingContext2D,
    stamp: WeldStampEntity,
    vp: ViewportTransform,
  ): void {
    const sc = worldToScreen(stamp.center, vp);
    const wPx = stamp.width * vp.zoom;
    const hPx = stamp.height * vp.zoom;
    if (wPx < 10) return;

    const primary = stamp.getPrimaryLabel();
    const secondary = stamp.getSecondaryLabel();
    const minDim = Math.min(wPx, hPx);

    ctx.save();
    ctx.fillStyle = stamp.strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (secondary) {
      const pSize = Math.max(9, Math.min(26, minDim * 0.24));
      const sSize = Math.max(8, Math.min(20, minDim * 0.19));
      const pY =
        stamp.shapeKind === 'triangle'
          ? sc.y - hPx * 0.08
          : sc.y - Math.min(hPx * 0.22, 16 * vp.zoom);
      const sY =
        stamp.shapeKind === 'triangle'
          ? sc.y + hPx * 0.3
          : sc.y + Math.min(hPx * 0.22, 16 * vp.zoom);

      ctx.font = `700 ${pSize}px "JetBrains Mono", monospace`;
      ctx.fillText(primary, sc.x, pY);
      ctx.font = `600 ${sSize}px "JetBrains Mono", monospace`;
      ctx.fillText(secondary, sc.x, sY);
    } else {
      const pSize = Math.max(10, Math.min(28, minDim * 0.28));
      const pY = stamp.shapeKind === 'triangle' ? sc.y + hPx * 0.12 : sc.y;
      ctx.font = `700 ${pSize}px "JetBrains Mono", monospace`;
      ctx.fillText(primary, sc.x, pY);
    }
    ctx.restore();
  }

  private drawDimensionText(
    ctx: CanvasRenderingContext2D,
    dim: DimensionEntity,
    vp: ViewportTransform,
  ): void {
    const { d1, d2, mid } = dim.getDimensionLinePoints();
    const smid = worldToScreen(mid, vp);
    const sd1 = worldToScreen(d1, vp);
    const sd2 = worldToScreen(d2, vp);
    const angle = Math.atan2(sd2.y - sd1.y, sd2.x - sd1.x);
    const uprightAngle = angle > Math.PI / 2 || angle < -Math.PI / 2 ? angle + Math.PI : angle;

    const label = `${Math.round(dim.getMeasuredMm())} mm`;
    ctx.save();
    ctx.translate(smid.x, smid.y);
    ctx.rotate(uprightAngle);
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const textW = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-textW * 0.5, -16, textW, 14);
    ctx.fillStyle = dim.strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -9);
    ctx.restore();
  }

  private drawFreeText(
    ctx: CanvasRenderingContext2D,
    ent: TextEntity,
    vp: ViewportTransform,
  ): void {
    const sp = worldToScreen(ent.position, vp);
    const pxSize = Math.max(8, ent.fontSize * vp.zoom);
    ctx.save();
    ctx.font = `600 ${pxSize}px Inter, sans-serif`;
    ctx.fillStyle = ent.strokeColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ent.text, sp.x, sp.y);
    ctx.restore();
  }

  private drawSnapIndicator(
    ctx: CanvasRenderingContext2D,
    snap: SnapPoint,
    vp: ViewportTransform,
  ): void {
    const sp = worldToScreen(snap.point, vp);
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    const r = 6;
    if (snap.kind === 'END') {
      ctx.strokeRect(sp.x - r, sp.y - r, r * 2, r * 2);
    } else if (snap.kind === 'MID') {
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - r - 1);
      ctx.lineTo(sp.x + r + 1, sp.y + r);
      ctx.lineTo(sp.x - r - 1, sp.y + r);
      ctx.closePath();
      ctx.stroke();
    } else if (snap.kind === 'CEN') {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(sp.x - r, sp.y - r);
      ctx.lineTo(sp.x + r, sp.y + r);
      ctx.moveTo(sp.x + r, sp.y - r);
      ctx.lineTo(sp.x - r, sp.y + r);
      ctx.stroke();
    }
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(snap.kind, sp.x + 10, sp.y - 8);
    ctx.restore();
  }

  private drawRulers(
    ctx: CanvasRenderingContext2D,
    vp: ViewportTransform,
    pageDims: { width: number; height: number } | null,
  ): void {
    const rulerSize = 22;
    const isLight =
      typeof document !== 'undefined' && document.documentElement.classList.contains('light');
    ctx.save();
    ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.94)' : 'rgba(9, 13, 22, 0.92)';
    ctx.fillRect(0, 0, this.cssW, rulerSize);
    ctx.fillRect(0, 0, rulerSize, this.cssH);
    ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.35)' : 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerSize);
    ctx.lineTo(this.cssW, rulerSize);
    ctx.moveTo(rulerSize, 0);
    ctx.lineTo(rulerSize, this.cssH);
    ctx.stroke();

    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.font = '500 9px "JetBrains Mono", monospace';

    const stepWorld = Math.max(25, Math.round(80 / Math.max(vp.zoom, 0.1) / 25) * 25);
    const maxW = pageDims?.width ?? 2400;
    const maxH = pageDims?.height ?? 1600;

    for (let x = 0; x <= maxW; x += stepWorld) {
      const sx = x * vp.zoom + vp.panX;
      if (sx < rulerSize || sx > this.cssW) continue;
      ctx.beginPath();
      ctx.moveTo(sx, rulerSize - 6);
      ctx.lineTo(sx, rulerSize);
      ctx.stroke();
      ctx.fillText(String(x), sx + 3, 12);
    }

    for (let y = 0; y <= maxH; y += stepWorld) {
      const sy = y * vp.zoom + vp.panY;
      if (sy < rulerSize || sy > this.cssH) continue;
      ctx.beginPath();
      ctx.moveTo(rulerSize - 6, sy);
      ctx.lineTo(rulerSize, sy);
      ctx.stroke();
      ctx.save();
      ctx.translate(11, sy + 3);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(y), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

export type { BoundingBox };
