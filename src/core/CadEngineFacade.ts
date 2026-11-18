import { CommandManager } from './commands/CommandManager';
import { EntityRepository } from './commands/EntityCommands';
import { ICadEntity, Point2D, SnapKind, SnapPoint } from './interfaces/ICadEntity';
import { ICadTool, ToolPointerEvent } from './interfaces/ICadTool';
import { LayerManager } from './layers/LayerManager';
import { OsnapEngine } from './spatial/OsnapEngine';
import { SpatialIndex } from './spatial/SpatialIndex';
import { IsoplaneMode } from './math/IsometricProjection';
import { CommandLineInterpreter } from './tools/CommandLineInterpreter';
import { LeaderStampTool } from './tools/LeaderStampTool';
import { LineTool } from './tools/LineTool';
import { SelectMoveTool } from './tools/SelectMoveTool';
import {
  CircleTool,
  DimensionTool,
  PolylineTool,
  RectOrRevCloudTool,
  TextTool,
} from './tools/ShapesAndAnnotationTools';
import { ToolRuntimeContext } from './tools/ToolContext';

export class CadEngineFacade {
  public readonly spatial = new SpatialIndex();
  public readonly osnap = new OsnapEngine(this.spatial);
  public readonly layers = new LayerManager();
  public readonly commands = new CommandManager();
  public readonly cli = new CommandLineInterpreter();

  private entities = new Map<string, ICadEntity>();
  private selectedIds = new Set<string>();
  private marqueeBox: { start: Point2D; current: Point2D; isCrossing: boolean } | null = null;
  private tools = new Map<string, ICadTool>();
  private activeTool: ICadTool;
  private currentSnap: SnapPoint | null = null;

  public activePage = 1;
  public strokeColor = '#ef4444';
  public zoom = 1;
  public orthoEnabled = false;
  public isoplaneMode: IsoplaneMode = 'OFF';
  public mmPerWorldUnit = (25.4 / 72) * 10;
  public enabledSnaps = new Set<SnapKind>(['END', 'MID', 'CEN', 'INT', 'QUAD']);
  public stampDefaults = { spoolNo: '', jointNo: '', welderId: '' };

  private listeners = {
    onRequestRender: () => {},
    onOpenJointWidget: (_id: string) => {},
    onRequestTextInput: (_pt: Point2D) => {},
    onEntitiesChanged: () => {},
    onSelectionChanged: (_ids: Set<string>) => {},
    onToolChanged: (_name: string) => {},
    onCliLog: (_msg: string) => {},
  };

  public readonly repo: EntityRepository = {
    add: (entity) => {
      this.entities.set(entity.id, entity);
      this.spatial.insert(entity);
      this.listeners.onEntitiesChanged();
    },
    remove: (id) => {
      this.entities.delete(id);
      this.spatial.remove(id);
      this.selectedIds.delete(id);
      this.listeners.onEntitiesChanged();
    },
    getById: (id) => this.entities.get(id),
    replace: (entity) => {
      this.entities.set(entity.id, entity);
      this.spatial.update(entity);
      this.listeners.onEntitiesChanged();
    },
  };

  constructor() {
    const ctx: ToolRuntimeContext = {
      repo: this.repo,
      commands: this.commands,
      spatial: this.spatial,
      osnap: this.osnap,
      layers: this.layers,
      getAllEntities: () => this.getPageEntities(),
      getSelectedIds: () => this.selectedIds,
      setSelectedIds: (ids) => {
        this.selectedIds = ids;
        this.listeners.onSelectionChanged(ids);
      },
      setMarqueeBox: (box) => {
        this.marqueeBox = box;
      },
      getActivePage: () => this.activePage,
      getStrokeColor: () => this.strokeColor,
      getZoom: () => this.zoom,
      getSnapOptions: () => ({
        toleranceWorld: 12 / Math.max(this.zoom, 0.1),
        enabledKinds: this.enabledSnaps,
        orthoEnabled: this.orthoEnabled,
        isoplaneMode: this.isoplaneMode,
      }),
      getMmPerWorldUnit: () => this.mmPerWorldUnit,
      getActiveStampDefaults: () => this.stampDefaults,
      onOpenJointWidget: (id) => this.listeners.onOpenJointWidget(id),
      onRequestTextInput: (pt) => this.listeners.onRequestTextInput(pt),
      onRequestRender: () => this.listeners.onRequestRender(),
      onLogCli: (msg) => this.listeners.onCliLog(msg),
      onSnapChanged: (sp) => {
        this.currentSnap = sp;
      },
    };

    const selectTool = new SelectMoveTool(ctx);
    const list: ICadTool[] = [
      selectTool,
      new LineTool(ctx, false),
      new LineTool(ctx, true),
      new PolylineTool(ctx),
      new CircleTool(ctx),
      new RectOrRevCloudTool(ctx, 'rect'),
      new RectOrRevCloudTool(ctx, 'revcloud'),
      new DimensionTool(ctx),
      new TextTool(ctx),
      new LeaderStampTool(ctx, 'triangle'),
      new LeaderStampTool(ctx, 'circle'),
      new LeaderStampTool(ctx, 'rect'),
      new LeaderStampTool(ctx, 'hexagon'),
    ];
    for (const t of list) this.tools.set(t.name, t);
    this.activeTool = selectTool;
  }

  public setCallbacks(cb: Partial<typeof this.listeners>): void {
    Object.assign(this.listeners, cb);
  }

  public setTool(name: string): void {
    const next = this.tools.get(name);
    if (!next) return;
    this.activeTool.onDeactivate();
    this.activeTool = next;
    this.activeTool.onActivate();
    this.listeners.onToolChanged(name);
    this.listeners.onRequestRender();
  }

  public getActiveTool(): ICadTool {
    return this.activeTool;
  }

  public getPageEntities(pageNum = this.activePage): ICadEntity[] {
    const out: ICadEntity[] = [];
    for (const ent of this.entities.values()) {
      if (ent.pageNumber !== pageNum) continue;
      const layer = this.layers.get(ent.layerId);
      if (layer && !layer.visible) continue;
      out.push(ent);
    }
    return out;
  }

  public getAllEntities(): ICadEntity[] {
    return Array.from(this.entities.values());
  }

  public getSelectedIds(): Set<string> {
    return this.selectedIds;
  }

  public getMarqueeBox() {
    return this.marqueeBox;
  }

  public getCurrentSnap(): SnapPoint | null {
    return this.currentSnap;
  }

  public handlePointerEvent(
    kind: 'down' | 'move' | 'up' | 'dblclick',
    world: Point2D,
    screen: Point2D,
    mods: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; button: number },
  ): void {
    const snap =
      this.activeTool.name !== 'select'
        ? this.osnap.findBestSnap(world, {
            toleranceWorld: 12 / Math.max(this.zoom, 0.1),
            enabledKinds: this.enabledSnaps,
            orthoEnabled: this.orthoEnabled,
            isoplaneMode: this.isoplaneMode,
          })
        : null;
    this.currentSnap = snap;
    const evt: ToolPointerEvent = {
      world,
      snapped: snap ? snap.point : world,
      screen,
      ...mods,
    };

    if (kind === 'down') this.activeTool.onPointerDown(evt);
    else if (kind === 'move') this.activeTool.onPointerMove(evt);
    else if (kind === 'up') this.activeTool.onPointerUp(evt);
    else if (kind === 'dblclick') this.activeTool.onDoubleClick?.(evt);
  }

  public clearAllEntities(): void {
    this.entities.clear();
    this.selectedIds.clear();
    this.spatial.clear();
    this.commands.clear();
    this.listeners.onEntitiesChanged();
    this.listeners.onRequestRender();
  }

  public loadEntities(list: ICadEntity[]): void {
    this.entities.clear();
    for (const e of list) this.entities.set(e.id, e);
    this.spatial.rebuild(list);
    this.listeners.onEntitiesChanged();
    this.listeners.onRequestRender();
  }
}
