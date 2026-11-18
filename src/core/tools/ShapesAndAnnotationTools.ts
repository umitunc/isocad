import { AddEntityCommand } from '../commands/EntityCommands';
import { CircleEntity } from '../entities/CircleEntity';
import { DimensionEntity } from '../entities/DimensionEntity';
import { PolylineEntity } from '../entities/PolylineEntity';
import { RectEntity } from '../entities/RectEntity';
import { RevCloudEntity } from '../entities/RevCloudEntity';
import { Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { hexToRgba } from '../math/GeometryIntersections';
import { ToolRuntimeContext } from './ToolContext';

export class PolylineTool implements ICadTool {
  public readonly name = 'polyline';
  public readonly shortcut = 'PL';
  public readonly cursor = 'crosshair';
  private points: Point2D[] = [];
  private cursorPt: Point2D | null = null;

  constructor(private readonly ctx: ToolRuntimeContext) {}

  public onActivate(): void {
    this.points = [];
    this.cursorPt = null;
  }
  public onDeactivate(): void {
    this.points = [];
    this.cursorPt = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    const pt =
      this.points.length > 0
        ? this.ctx.osnap.applyAxisConstraint(
            this.points[this.points.length - 1],
            evt.snapped,
            this.ctx.getSnapOptions(),
          )
        : evt.snapped;
    this.points.push({ ...pt });
    this.cursorPt = { ...pt };
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (this.points.length === 0) return;
    this.cursorPt = this.ctx.osnap.applyAxisConstraint(
      this.points[this.points.length - 1],
      evt.snapped,
      this.ctx.getSnapOptions(),
    );
    this.ctx.onRequestRender();
  }

  public onPointerUp(): void {}

  public onDoubleClick(): void {
    this.finish(false);
  }

  public onKeyDown(key: string): void {
    if (key === 'Enter') this.finish(false);
    if (key === 'c' || key === 'C') this.finish(true);
    if (key === 'Escape') {
      this.points = [];
      this.cursorPt = null;
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
    this.points = [];
    this.cursorPt = null;
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
    if (this.cursorPt) {
      const last = this.points[this.points.length - 1];
      out.push({
        x1: last.x,
        y1: last.y,
        x2: this.cursorPt.x,
        y2: this.cursorPt.y,
        colorRgba,
        width: 2,
        dashPattern: [5, 4],
      });
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
