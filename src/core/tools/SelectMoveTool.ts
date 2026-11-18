import {
  BatchCommand,
  MoveLeaderAnchorCommand,
  RemoveEntityCommand,
  TranslateEntityCommand,
} from '../commands/EntityCommands';
import { WeldStampEntity } from '../entities/WeldStampEntity';
import { BoundingBox, Point2D, RenderLinePrimitive } from '../interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from '../interfaces/ICadTool';
import { boxContains, boxesOverlap } from '../math/GeometryIntersections';
import { ToolRuntimeContext } from './ToolContext';

export class SelectMoveTool implements ICadTool {
  public readonly name = 'select';
  public readonly shortcut = 'ESC';
  public readonly cursor = 'default';

  private isDraggingEntities = false;
  private draggingGripStampId: string | null = null;
  private gripStartAnchor: Point2D | null = null;
  private gripLastAnchor: Point2D | null = null;
  private isMarquee = false;
  private dragStart: Point2D | null = null;
  private dragLast: Point2D | null = null;
  private totalDx = 0;
  private totalDy = 0;

  constructor(private readonly ctx: ToolRuntimeContext) {}

  public onActivate(): void {}
  public onDeactivate(): void {
    this.isDraggingEntities = false;
    this.draggingGripStampId = null;
    this.gripStartAnchor = null;
    this.gripLastAnchor = null;
    this.isMarquee = false;
    this.ctx.setMarqueeBox(null);
  }

  private findLeaderAnchorGripHit(world: Point2D, gripTol: number): WeldStampEntity | null {
    // Prefer already-selected stamps first
    for (const id of this.ctx.getSelectedIds()) {
      const ent = this.ctx.repo.getById(id);
      if (ent instanceof WeldStampEntity && ent.visible && !ent.locked && ent.hasLeader) {
        if (Math.hypot(world.x - ent.leaderAnchor.x, world.y - ent.leaderAnchor.y) <= gripTol) {
          return ent;
        }
      }
    }
    // Also allow grabbing the leader tip directly on an unselected stamp
    for (const ent of this.ctx.spatial.searchPoint(world, gripTol)) {
      if (ent instanceof WeldStampEntity && ent.visible && !ent.locked && ent.hasLeader) {
        if (Math.hypot(world.x - ent.leaderAnchor.x, world.y - ent.leaderAnchor.y) <= gripTol) {
          return ent;
        }
      }
    }
    return null;
  }

  public onPointerDown(evt: ToolPointerEvent): void {
    const zoom = Math.max(this.ctx.getZoom(), 0.1);
    const tol = 8 / zoom;
    const gripTol = 10 / zoom;

    const gripStamp = this.findLeaderAnchorGripHit(evt.world, gripTol);
    if (gripStamp) {
      if (!this.ctx.getSelectedIds().has(gripStamp.id)) {
        this.ctx.setSelectedIds(new Set([gripStamp.id]));
      }
      this.draggingGripStampId = gripStamp.id;
      this.gripStartAnchor = { ...gripStamp.leaderAnchor };
      this.gripLastAnchor = { ...gripStamp.leaderAnchor };
      this.ctx.onRequestRender();
      return;
    }

    const candidates = this.ctx.spatial.searchPoint(evt.world, tol);
    const hit = candidates.find((e) => e.visible && !e.locked && e.hitTest(evt.world, tol));

    if (hit) {
      const current = new Set(this.ctx.getSelectedIds());
      if (evt.shiftKey) {
        if (current.has(hit.id)) current.delete(hit.id);
        else current.add(hit.id);
        this.ctx.setSelectedIds(current);
      } else if (!current.has(hit.id)) {
        this.ctx.setSelectedIds(new Set([hit.id]));
      }
      this.isDraggingEntities = true;
      this.dragStart = { ...evt.world };
      this.dragLast = { ...evt.world };
      this.totalDx = 0;
      this.totalDy = 0;
      this.ctx.onRequestRender();
      return;
    }

    if (!evt.shiftKey) {
      this.ctx.setSelectedIds(new Set());
    }
    this.isMarquee = true;
    this.dragStart = { ...evt.world };
    this.ctx.setMarqueeBox({ start: evt.world, current: evt.world, isCrossing: false });
    this.ctx.onRequestRender();
  }

  public onPointerMove(evt: ToolPointerEvent): void {
    if (this.draggingGripStampId) {
      const ent = this.ctx.repo.getById(this.draggingGripStampId);
      if (ent instanceof WeldStampEntity && !ent.locked) {
        const nextPt = evt.snapped ?? evt.world;
        ent.leaderAnchor = { x: nextPt.x, y: nextPt.y };
        this.gripLastAnchor = { ...ent.leaderAnchor };
        this.ctx.spatial.update(ent);
        this.ctx.onRequestRender();
        return;
      }
    }

    if (this.isDraggingEntities && this.dragLast) {
      const dx = evt.world.x - this.dragLast.x;
      const dy = evt.world.y - this.dragLast.y;
      this.totalDx += dx;
      this.totalDy += dy;
      for (const id of this.ctx.getSelectedIds()) {
        const ent = this.ctx.repo.getById(id);
        if (ent && !ent.locked) {
          ent.translate(dx, dy);
          this.ctx.spatial.update(ent);
        }
      }
      this.dragLast = { ...evt.world };
      this.ctx.onRequestRender();
      return;
    }

    if (this.isMarquee && this.dragStart) {
      const isCrossing = evt.world.x < this.dragStart.x;
      this.ctx.setMarqueeBox({ start: this.dragStart, current: evt.world, isCrossing });
      this.ctx.onRequestRender();
    }
  }

  public onPointerUp(evt: ToolPointerEvent): void {
    if (this.draggingGripStampId) {
      const ent = this.ctx.repo.getById(this.draggingGripStampId);
      const startAnchor = this.gripStartAnchor;
      const finalAnchor = this.gripLastAnchor ?? evt.snapped ?? evt.world;
      if (
        ent instanceof WeldStampEntity &&
        startAnchor &&
        (Math.abs(finalAnchor.x - startAnchor.x) > 0.1 ||
          Math.abs(finalAnchor.y - startAnchor.y) > 0.1)
      ) {
        ent.leaderAnchor = { ...startAnchor };
        this.ctx.commands.execute(
          new MoveLeaderAnchorCommand(this.ctx.repo, ent.id, startAnchor, finalAnchor),
        );
      }
      this.draggingGripStampId = null;
      this.gripStartAnchor = null;
      this.gripLastAnchor = null;
      this.ctx.onRequestRender();
      return;
    }

    if (this.isDraggingEntities) {
      this.isDraggingEntities = false;
      if (Math.abs(this.totalDx) > 0.1 || Math.abs(this.totalDy) > 0.1) {
        // Revert live drag and commit via CommandManager for proper Undo/Redo
        const ids = Array.from(this.ctx.getSelectedIds());
        for (const id of ids) {
          const ent = this.ctx.repo.getById(id);
          if (ent) {
            ent.translate(-this.totalDx, -this.totalDy);
          }
        }
        const cmds = ids.map(
          (id) => new TranslateEntityCommand(this.ctx.repo, id, this.totalDx, this.totalDy),
        );
        this.ctx.commands.execute(new BatchCommand(cmds, `Move ${ids.length} item(s)`));
      }
      this.dragStart = null;
      this.dragLast = null;
      this.ctx.onRequestRender();
      return;
    }

    if (this.isMarquee && this.dragStart) {
      const isCrossing = evt.world.x < this.dragStart.x;
      const box: BoundingBox = {
        minX: Math.min(this.dragStart.x, evt.world.x),
        minY: Math.min(this.dragStart.y, evt.world.y),
        maxX: Math.max(this.dragStart.x, evt.world.x),
        maxY: Math.max(this.dragStart.y, evt.world.y),
      };
      const next = new Set(evt.shiftKey ? this.ctx.getSelectedIds() : []);
      for (const ent of this.ctx.spatial.searchBox(box)) {
        if (!ent.visible || ent.locked) continue;
        const eb = ent.getBoundingBox();
        if (isCrossing ? boxesOverlap(box, eb) : boxContains(box, eb)) {
          next.add(ent.id);
        }
      }
      this.ctx.setSelectedIds(next);
      this.isMarquee = false;
      this.dragStart = null;
      this.ctx.setMarqueeBox(null);
      this.ctx.onRequestRender();
    }
  }

  public onDoubleClick(evt: ToolPointerEvent): void {
    const tol = 8 / Math.max(this.ctx.getZoom(), 0.1);
    const hit = this.ctx.spatial
      .searchPoint(evt.world, tol)
      .find((e) => e.visible && e.type === 'weld_stamp' && e.hitTest(evt.world, tol));
    if (hit && this.ctx.onOpenJointWidget) {
      this.ctx.onOpenJointWidget(hit.id);
    }
  }

  public onKeyDown(key: string): void {
    if (key === 'Delete' || key === 'Backspace') {
      const ids = Array.from(this.ctx.getSelectedIds());
      if (ids.length === 0) return;
      const cmds = ids
        .map((id) => this.ctx.repo.getById(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e && !e.locked))
        .map((e) => new RemoveEntityCommand(this.ctx.repo, e));
      if (cmds.length > 0) {
        this.ctx.commands.execute(new BatchCommand(cmds, `Delete ${cmds.length} item(s)`));
        this.ctx.setSelectedIds(new Set());
        this.ctx.onRequestRender();
      }
    }
  }

  public getPreviewPrimitives(): RenderLinePrimitive[] {
    return [];
  }
}
