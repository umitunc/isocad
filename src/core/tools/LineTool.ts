import { AddEntityCommand } from '../commands/EntityCommands';
import { LineEntity } from '../entities/LineEntity';
import { Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { hexToRgba } from '../math/GeometryIntersections';
import { parsePolarOrRelativeInput } from '../math/IsometricProjection';
import { ToolRuntimeContext } from './ToolContext';

export class LineTool implements ICadTool {
  public readonly name: string;
  public readonly shortcut: string;
  public readonly cursor = 'crosshair';

  private startPt: Point2D | null = null;
  private currentPt: Point2D | null = null;

  constructor(
    private readonly ctx: ToolRuntimeContext,
    private readonly isArrow = false,
  ) {
    this.name = isArrow ? 'arrow' : 'line';
    this.shortcut = isArrow ? 'AR' : 'L';
  }

  public onActivate(): void {
    this.startPt = null;
    this.currentPt = null;
  }

  public onDeactivate(): void {
    this.startPt = null;
    this.currentPt = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    if (!this.startPt) {
      this.startPt = { ...evt.snapped };
      this.currentPt = { ...evt.snapped };
      this.ctx.onLogCli?.(`Specify next point or @dist<angle:`);
    } else {
      const endPt = this.ctx.osnap.applyAxisConstraint(
        this.startPt,
        evt.snapped,
        this.ctx.getSnapOptions(),
      );
      this.commitLine(this.startPt, endPt);
      this.startPt = null;
      this.currentPt = null;
    }
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (!this.startPt) return;
    this.currentPt = this.ctx.osnap.applyAxisConstraint(
      this.startPt,
      evt.snapped,
      this.ctx.getSnapOptions(),
    );
    this.ctx.onRequestRender();
  }

  public onPointerUp(_evt: ToolPointerEvent): void {}

  public onKeyDown(key: string): void {
    if (key === 'Escape') {
      this.startPt = null;
      this.currentPt = null;
      this.ctx.onRequestRender();
    }
  }

  public onCommandInput(rawInput: string): boolean {
    const pt = parsePolarOrRelativeInput(rawInput, this.startPt ?? undefined);
    if (!pt) return false;
    if (!this.startPt) {
      this.startPt = pt;
      this.currentPt = pt;
    } else {
      this.commitLine(this.startPt, pt);
      this.startPt = pt;
    }
    this.ctx.onRequestRender();
    return true;
  }

  private commitLine(p1: Point2D, p2: Point2D): void {
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 1) return;
    const entity = new LineEntity(`line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, p1, p2, {
      layerId: this.ctx.layers.getActiveLayerId(),
      pageNumber: this.ctx.getActivePage(),
      strokeColor: this.ctx.getStrokeColor(),
      isArrow: this.isArrow,
    });
    this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, entity));
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (!this.startPt || !this.currentPt) return [];
    return [
      {
        x1: this.startPt.x,
        y1: this.startPt.y,
        x2: this.currentPt.x,
        y2: this.currentPt.y,
        colorRgba: hexToRgba(this.ctx.getStrokeColor(), 0.75),
        width: 2,
        dashPattern: [5, 4],
      },
    ];
  }
}
