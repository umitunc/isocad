import { AddEntityCommand } from '../commands/EntityCommands';
import { WeldStampEntity } from '../entities/WeldStampEntity';
import { Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { StampShapeKind } from '../math/LeaderEdgeAnchor';
import { ToolRuntimeContext } from './ToolContext';

const DRAG_THRESHOLD_PX = 5;

export class LeaderStampTool implements ICadTool {
  public readonly name: string;
  public readonly shortcut: string;
  public readonly cursor = 'crosshair';

  private anchorPt: Point2D | null = null;
  private endPt: Point2D | null = null;
  private hoverPt: Point2D | null = null;
  private downScreenPt: Point2D | null = null;
  private isDragging = false;

  constructor(
    private readonly ctx: ToolRuntimeContext,
    private readonly shapeKind: StampShapeKind,
  ) {
    this.name = `stamp_${shapeKind}`;
    this.shortcut = shapeKind === 'triangle' ? 'FJ' : shapeKind === 'circle' ? 'SJ' : 'SP';
  }

  private resetState(): void {
    this.anchorPt = null;
    this.endPt = null;
    this.hoverPt = null;
    this.downScreenPt = null;
    this.isDragging = false;
  }

  public onActivate(): void {
    this.resetState();
  }

  public onDeactivate(): void {
    this.resetState();
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    if (evt.button !== 0) return;
    if (!this.anchorPt) {
      this.anchorPt = { ...evt.snapped };
      this.endPt = { ...evt.snapped };
      this.downScreenPt = { ...evt.screen };
      this.isDragging = false;
      this.ctx.onRequestRender();
      return;
    }

    // Second click in two-click mode: place the geometric shape at the clicked point.
    this.commitStamp({ ...evt.snapped });
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    this.hoverPt = { ...evt.snapped };
    if (!this.anchorPt) {
      this.ctx.onRequestRender();
      return;
    }
    if (this.downScreenPt && !this.isDragging) {
      const distPx = Math.hypot(
        evt.screen.x - this.downScreenPt.x,
        evt.screen.y - this.downScreenPt.y,
      );
      if (distPx >= DRAG_THRESHOLD_PX) {
        this.isDragging = true;
      }
    }
    this.endPt = { ...evt.snapped };
    this.ctx.onRequestRender();
  }

  public onPointerUp(evt: ToolPointerEvent): void {
    if (!this.anchorPt) return;
    this.downScreenPt = null;
    if (!this.isDragging) return;
    this.isDragging = false;
    this.commitStamp({ ...evt.snapped });
  }

  public onKeyDown(key: string): void {
    if (key === 'Escape') {
      this.anchorPt = null;
      this.endPt = null;
      this.downScreenPt = null;
      this.isDragging = false;
      this.ctx.onRequestRender();
    }
  }

  private getStampSize(): { w: number; h: number } {
    return this.shapeKind === 'rect' ? { w: 72, h: 36 } : { w: 40, h: 40 };
  }

  private commitStamp(targetPt: Point2D): void {
    if (!this.anchorPt) return;
    const target =
      Math.hypot(targetPt.x - this.anchorPt.x, targetPt.y - this.anchorPt.y) < 5
        ? { x: this.anchorPt.x + 42, y: this.anchorPt.y - 42 }
        : { ...targetPt };

    const defaults = this.ctx.getActiveStampDefaults();
    const id = `J-${Date.now().toString().slice(-5)}`;
    const size = this.getStampSize();

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
    this.downScreenPt = null;
    this.isDragging = false;
    this.ctx.onRequestRender();

    if (
      (this.shapeKind === 'triangle' || this.shapeKind === 'circle') &&
      this.ctx.onOpenJointWidget
    ) {
      this.ctx.onOpenJointWidget(stamp.id);
    }
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    const size = this.getStampSize();
    const defaults = this.ctx.getActiveStampDefaults();

    if (this.anchorPt && this.endPt) {
      const preview = new WeldStampEntity({
        id: '__preview__',
        shapeKind: this.shapeKind,
        center: this.endPt,
        width: size.w,
        height: size.h,
        leaderAnchor: this.anchorPt,
        hasLeader: true,
        spoolNo: defaults.spoolNo,
        jointNo: defaults.jointNo,
        welderId: defaults.welderId,
        strokeColor: this.ctx.getStrokeColor(),
      });
      return preview.toRenderPrimitives(false, false).map((p) => ({
        ...p,
        colorRgba: [p.colorRgba[0], p.colorRgba[1], p.colorRgba[2], p.colorRgba[3] * 0.78],
      }));
    }

    if (this.hoverPt) {
      const ghost = new WeldStampEntity({
        id: '__ghost__',
        shapeKind: this.shapeKind,
        center: this.hoverPt,
        width: size.w,
        height: size.h,
        leaderAnchor: this.hoverPt,
        hasLeader: false,
        spoolNo: defaults.spoolNo,
        jointNo: defaults.jointNo,
        welderId: defaults.welderId,
        strokeColor: this.ctx.getStrokeColor(),
      });
      return ghost.toRenderPrimitives(false, false).map((p) => ({
        ...p,
        colorRgba: [p.colorRgba[0], p.colorRgba[1], p.colorRgba[2], p.colorRgba[3] * 0.5],
      }));
    }

    return [];
  }
}
