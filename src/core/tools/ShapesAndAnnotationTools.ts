import { AddEntityCommand } from '../commands/EntityCommands';
import { CircleEntity } from '../entities/CircleEntity';
import { DimensionEntity } from '../entities/DimensionEntity';
import { PolylineEntity } from '../entities/PolylineEntity';
import { RectEntity } from '../entities/RectEntity';
import { RevCloudEntity } from '../entities/RevCloudEntity';
import { Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { hexToRgba } from '../math/GeometryIntersections';
import { routeAroundObstacles } from '../math/ObstacleRouter';
import { ToolRuntimeContext } from './ToolContext';

const DRAG_THRESHOLD_PX = 5;
const TRACE_SAMPLE_PX = 4;
const TRACE_SIMPLIFY_PX = 6;

function perpendicularDistance(pt: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

/** Ramer-Douglas-Peucker simplification to convert a dragged path into clean polyline breakpoints. */
function simplifyPolyline(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let maxIdx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolyline(pts.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolyline(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

export class PolylineTool implements ICadTool {
  public readonly name = 'polyline';
  public readonly shortcut = 'PL';
  public readonly cursor = 'crosshair';
  private points: Point2D[] = [];
  private cursorPt: Point2D | null = null;
  private routedPreview: Point2D[] = [];
  private isPointerDown = false;
  private downScreenPt: Point2D | null = null;
  private isDraggingTrace = false;
  private tracePoints: Point2D[] = [];

  constructor(private readonly ctx: ToolRuntimeContext) {}

  private resetState(): void {
    this.points = [];
    this.cursorPt = null;
    this.routedPreview = [];
    this.isPointerDown = false;
    this.downScreenPt = null;
    this.isDraggingTrace = false;
    this.tracePoints = [];
  }

  private computeRoutedSegment(from: Point2D, to: Point2D, bypassObstacles: boolean): Point2D[] {
    if (bypassObstacles) return [from, to];
    const padding = Math.max(4, 8 / Math.max(this.ctx.getZoom(), 0.25));
    return routeAroundObstacles(
      from,
      to,
      this.ctx.getAllEntities(),
      this.ctx.getActivePage(),
      padding,
    );
  }

  public onActivate(): void {
    this.resetState();
  }
  public onDeactivate(): void {
    this.resetState();
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    if (evt.button !== 0) return;
    const prev = this.points.length > 0 ? this.points[this.points.length - 1] : null;
    const pt = prev
      ? this.ctx.osnap.applyAxisConstraint(prev, evt.snapped, this.ctx.getSnapOptions())
      : evt.snapped;
    this.isPointerDown = true;
    this.downScreenPt = { ...evt.screen };
    this.isDraggingTrace = false;
    if (prev) {
      const routed = this.computeRoutedSegment(prev, pt, evt.altKey);
      this.points.push(...routed.slice(1).map((p) => ({ ...p })));
    } else {
      this.points.push({ ...pt });
    }
    this.tracePoints = [{ ...pt }];
    this.cursorPt = { ...pt };
    this.routedPreview = [];
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (this.isPointerDown && this.downScreenPt) {
      if (!this.isDraggingTrace) {
        const screenDist = Math.hypot(
          evt.screen.x - this.downScreenPt.x,
          evt.screen.y - this.downScreenPt.y,
        );
        if (screenDist >= DRAG_THRESHOLD_PX) {
          this.isDraggingTrace = true;
          this.cursorPt = null;
          this.routedPreview = [];
        }
      }
      if (this.isDraggingTrace) {
        const minStepWorld = TRACE_SAMPLE_PX / Math.max(this.ctx.getZoom(), 0.1);
        const last = this.tracePoints[this.tracePoints.length - 1];
        if (!last || Math.hypot(evt.world.x - last.x, evt.world.y - last.y) >= minStepWorld) {
          this.tracePoints.push({ ...evt.world });
        }
        this.ctx.onRequestRender();
        return;
      }
    }

    if (this.points.length === 0) return;
    const prev = this.points[this.points.length - 1];
    this.cursorPt = this.ctx.osnap.applyAxisConstraint(
      prev,
      evt.snapped,
      this.ctx.getSnapOptions(),
    );
    this.routedPreview = this.computeRoutedSegment(prev, this.cursorPt, evt.altKey);
    this.ctx.onRequestRender();
  }

  public onPointerUp(evt: ToolPointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.downScreenPt = null;

    if (!this.isDraggingTrace) return;
    this.isDraggingTrace = false;

    const last = this.tracePoints[this.tracePoints.length - 1];
    if (!last || Math.hypot(evt.snapped.x - last.x, evt.snapped.y - last.y) > 0.5) {
      this.tracePoints.push({ ...evt.snapped });
    }

    const epsilon = TRACE_SIMPLIFY_PX / Math.max(this.ctx.getZoom(), 0.1);
    const simplified = simplifyPolyline(this.tracePoints, epsilon);
    if (simplified.length >= 2) {
      this.points.push(...simplified.slice(1));
    }
    this.tracePoints = [];
    this.finish(false);
  }

  public onDoubleClick(): void {
    this.finish(false);
  }

  public onKeyDown(key: string): void {
    if (key === 'Enter') this.finish(false);
    if (key === 'c' || key === 'C') this.finish(true);
    if (key === 'Escape') {
      this.resetState();
      this.ctx.onRequestRender();
    }
  }

  private finish(closed: boolean): void {
    if (this.points.length >= 2) {
      const entity = new PolylineEntity(`pl-${Date.now()}`, this.points, {
        layerId: this.ctx.layers.getActiveLayerId(),
        pageNumber: this.ctx.getActivePage(),
        strokeColor: this.ctx.getStrokeColor(),
        closed,
      });
      this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, entity));
    }
    this.resetState();
    this.ctx.onRequestRender();
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (this.points.length === 0) return [];
    const colorRgba = hexToRgba(this.ctx.getStrokeColor(), 0.75);
    const out: RenderLinePrimitive[] = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      out.push({
        x1: this.points[i].x,
        y1: this.points[i].y,
        x2: this.points[i + 1].x,
        y2: this.points[i + 1].y,
        colorRgba,
        width: 2,
      });
    }
    if (this.isDraggingTrace && this.tracePoints.length >= 2) {
      const epsilon = TRACE_SIMPLIFY_PX / Math.max(this.ctx.getZoom(), 0.1);
      const previewPts = simplifyPolyline(this.tracePoints, epsilon);
      for (let i = 0; i < previewPts.length - 1; i++) {
        out.push({
          x1: previewPts[i].x,
          y1: previewPts[i].y,
          x2: previewPts[i + 1].x,
          y2: previewPts[i + 1].y,
          colorRgba,
          width: 2,
        });
      }
    } else if (this.cursorPt) {
      const previewPts =
        this.routedPreview.length >= 2
          ? this.routedPreview
          : [this.points[this.points.length - 1], this.cursorPt];
      for (let i = 0; i < previewPts.length - 1; i++) {
        out.push({
          x1: previewPts[i].x,
          y1: previewPts[i].y,
          x2: previewPts[i + 1].x,
          y2: previewPts[i + 1].y,
          colorRgba,
          width: 2,
          dashPattern: [5, 4],
        });
      }
    }
    return out;
  }
}

export class CircleTool implements ICadTool {
  public readonly name = 'circle';
  public readonly shortcut = 'C';
  public readonly cursor = 'crosshair';
  private center: Point2D | null = null;
  private edge: Point2D | null = null;

  constructor(private readonly ctx: ToolRuntimeContext) {}

  public onActivate(): void {
    this.center = null;
    this.edge = null;
  }
  public onDeactivate(): void {
    this.center = null;
    this.edge = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    if (!this.center) {
      this.center = { ...evt.snapped };
      this.edge = { ...evt.snapped };
    } else {
      const r = Math.hypot(evt.snapped.x - this.center.x, evt.snapped.y - this.center.y);
      if (r >= 2) {
        const entity = new CircleEntity(`cir-${Date.now()}`, this.center, r, {
          layerId: this.ctx.layers.getActiveLayerId(),
          pageNumber: this.ctx.getActivePage(),
          strokeColor: this.ctx.getStrokeColor(),
        });
        this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, entity));
      }
      this.center = null;
      this.edge = null;
    }
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (!this.center) return;
    this.edge = { ...evt.snapped };
    this.ctx.onRequestRender();
  }

  public onPointerUp(): void {}

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (!this.center || !this.edge) return [];
    const r = Math.hypot(this.edge.x - this.center.x, this.edge.y - this.center.y);
    if (r < 1) return [];
    const colorRgba = hexToRgba(this.ctx.getStrokeColor(), 0.75);
    const out: RenderLinePrimitive[] = [];
    for (let i = 0; i < 36; i++) {
      const a1 = (i / 36) * Math.PI * 2;
      const a2 = ((i + 1) / 36) * Math.PI * 2;
      out.push({
        x1: this.center.x + Math.cos(a1) * r,
        y1: this.center.y + Math.sin(a1) * r,
        x2: this.center.x + Math.cos(a2) * r,
        y2: this.center.y + Math.sin(a2) * r,
        colorRgba,
        width: 1.8,
      });
    }
    return out;
  }
}

export class RectOrRevCloudTool implements ICadTool {
  public readonly name: string;
  public readonly shortcut: string;
  public readonly cursor = 'crosshair';
  private start: Point2D | null = null;
  private end: Point2D | null = null;

  constructor(
    private readonly ctx: ToolRuntimeContext,
    private readonly mode: 'rect' | 'revcloud',
  ) {
    this.name = mode;
    this.shortcut = mode === 'rect' ? 'REC' : 'CLOUD';
  }

  public onActivate(): void {
    this.start = null;
    this.end = null;
  }
  public onDeactivate(): void {
    this.start = null;
    this.end = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    this.start = { ...evt.snapped };
    this.end = { ...evt.snapped };
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (!this.start) return;
    this.end = { ...evt.snapped };
    this.ctx.onRequestRender();
  }

  public onPointerUp(evt: ToolPointerEvent): void {
    if (!this.start) return;
    const x = Math.min(this.start.x, evt.snapped.x);
    const y = Math.min(this.start.y, evt.snapped.y);
    const w = Math.abs(evt.snapped.x - this.start.x);
    const h = Math.abs(evt.snapped.y - this.start.y);
    if (w >= 4 && h >= 4) {
      const ent =
        this.mode === 'rect'
          ? new RectEntity(`rect-${Date.now()}`, x, y, w, h, {
              layerId: this.ctx.layers.getActiveLayerId(),
              pageNumber: this.ctx.getActivePage(),
              strokeColor: this.ctx.getStrokeColor(),
            })
          : new RevCloudEntity(`cloud-${Date.now()}`, x, y, w, h, {
              pageNumber: this.ctx.getActivePage(),
            });
      this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, ent));
    }
    this.start = null;
    this.end = null;
    this.ctx.onRequestRender();
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (!this.start || !this.end) return [];
    const colorRgba = hexToRgba(
      this.mode === 'revcloud' ? '#f43f5e' : this.ctx.getStrokeColor(),
      0.75,
    );
    const x1 = this.start.x;
    const y1 = this.start.y;
    const x2 = this.end.x;
    const y2 = this.end.y;
    return [
      { x1, y1, x2, y2: y1, colorRgba, width: 1.8, dashPattern: [5, 3] },
      { x1: x2, y1, x2, y2, colorRgba, width: 1.8, dashPattern: [5, 3] },
      { x1: x2, y1: y2, x2: x1, y2, colorRgba, width: 1.8, dashPattern: [5, 3] },
      { x1, y1: y2, x2: x1, y2: y1, colorRgba, width: 1.8, dashPattern: [5, 3] },
    ];
  }
}

export class DimensionTool implements ICadTool {
  public readonly name = 'dimension';
  public readonly shortcut = 'DIM';
  public readonly cursor = 'crosshair';
  private p1: Point2D | null = null;
  private p2: Point2D | null = null;

  constructor(private readonly ctx: ToolRuntimeContext) {}

  public onActivate(): void {
    this.p1 = null;
    this.p2 = null;
  }
  public onDeactivate(): void {
    this.p1 = null;
    this.p2 = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    if (!this.p1) {
      this.p1 = { ...evt.snapped };
      this.p2 = { ...evt.snapped };
    } else {
      const end = this.ctx.osnap.applyAxisConstraint(this.p1, evt.snapped, this.ctx.getSnapOptions());
      if (Math.hypot(end.x - this.p1.x, end.y - this.p1.y) >= 4) {
        const dim = new DimensionEntity(`dim-${Date.now()}`, this.p1, end, {
          mmPerWorldUnit: this.ctx.getMmPerWorldUnit(),
          pageNumber: this.ctx.getActivePage(),
        });
        this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, dim));
      }
      this.p1 = null;
      this.p2 = null;
    }
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (!this.p1) return;
    this.p2 = this.ctx.osnap.applyAxisConstraint(this.p1, evt.snapped, this.ctx.getSnapOptions());
    this.ctx.onRequestRender();
  }

  public onPointerUp(): void {}

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (!this.p1 || !this.p2) return [];
    const colorRgba = hexToRgba('#facc15', 0.85);
    return [{ x1: this.p1.x, y1: this.p1.y, x2: this.p2.x, y2: this.p2.y, colorRgba, width: 1.8 }];
  }
}

export class TextTool implements ICadTool {
  public readonly name = 'text';
  public readonly shortcut = 'T';
  public readonly cursor = 'text';

  constructor(private readonly ctx: ToolRuntimeContext) {}

  public onActivate(): void {}
  public onDeactivate(): void {}
  public onPointerDown(evt: ToolPointerEvent): void {
    this.ctx.onRequestTextInput?.(evt.snapped);
  }
  public onPointerMove(): void {}
  public onPointerUp(): void {}
  public getPreviewPrimitives(): RenderLinePrimitive[] {
    return [];
  }
}
