import { AddEntityCommand } from '../commands/EntityCommands';
import { WeldStampEntity } from '../entities/WeldStampEntity';
import { Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { hexToRgba } from '../math/GeometryIntersections';
import { StampShapeKind } from '../math/LeaderEdgeAnchor';
import { ToolRuntimeContext } from './ToolContext';

export class LeaderStampTool implements ICadTool {
  public readonly name: string;
  public readonly shortcut: string;
  public readonly cursor = 'crosshair';

  private anchorPt: Point2D | null = null;
  private endPt: Point2D | null = null;

  constructor(
    private readonly ctx: ToolRuntimeContext,
    private readonly shapeKind: StampShapeKind,
  ) {
    this.name = `stamp_${shapeKind}`;
    this.shortcut = shapeKind === 'triangle' ? 'FJ' : shapeKind === 'circle' ? 'SJ' : 'SP';
  }

  public onActivate(): void {
    this.anchorPt = null;
    this.endPt = null;
  }

  public onDeactivate(): void {
    this.anchorPt = null;
    this.endPt = null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    this.anchorPt = { ...evt.snapped };
    this.endPt = { x: evt.snapped.x + 36, y: evt.snapped.y - 36 };
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (!this.anchorPt) return;
    this.endPt = { ...evt.snapped };
    this.ctx.onRequestRender();
  }

  public onPointerUp(evt: ToolPointerEvent): void {
    if (!this.anchorPt) return;
    const target =
      Math.hypot(evt.snapped.x - this.anchorPt.x, evt.snapped.y - this.anchorPt.y) < 5
        ? { x: this.anchorPt.x + 42, y: this.anchorPt.y - 42 }
        : { ...evt.snapped };

    const defaults = this.ctx.getActiveStampDefaults();
    const id = `J-${Date.now().toString().slice(-5)}`;
    const size = this.shapeKind === 'rect' ? { w: 72, h: 36 } : { w: 40, h: 40 };

    const stamp = new WeldStampEntity({
      id,
      shapeKind: this.shapeKind,
      center: target,
      width: size.w,
      height: size.h,
      leaderAnchor: this.anchorPt,
      hasLeader: true,
      spoolNo: defaults.spoolNo,
      jointNo: defaults.jointNo,
      welderId: defaults.welderId,
      pageNumber: this.ctx.getActivePage(),
      strokeColor: this.ctx.getStrokeColor(),
    });

    this.ctx.commands.execute(new AddEntityCommand(this.ctx.repo, stamp));
    this.anchorPt = null;
    this.endPt = null;
    this.ctx.onRequestRender();

    if (
      (this.shapeKind === 'triangle' || this.shapeKind === 'circle') &&
      this.ctx.onOpenJointWidget
    ) {
      this.ctx.onOpenJointWidget(stamp.id);
    }
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    if (!this.anchorPt || !this.endPt) return [];
    const colorRgba = hexToRgba(this.ctx.getStrokeColor(), 0.8);
    return [
      {
        x1: this.anchorPt.x,
        y1: this.anchorPt.y,
        x2: this.endPt.x,
        y2: this.endPt.y,
        colorRgba,
        width: 2,
        dashPattern: [4, 3],
      },
    ];
  }
}
