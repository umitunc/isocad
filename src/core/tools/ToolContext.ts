import { CommandManager } from '../commands/CommandManager';
import { EntityRepository } from '../commands/EntityCommands';
import { ICadEntity, Point2D, SnapPoint } from '../interfaces/ICadEntity';
import { LayerManager } from '../layers/LayerManager';
import { OsnapEngine } from '../spatial/OsnapEngine';
import { SpatialIndex } from '../spatial/SpatialIndex';
import { SnapSearchOptions } from '../interfaces/ISnapProvider';

export interface ToolRuntimeContext {
  repo: EntityRepository;
  commands: CommandManager;
  spatial: SpatialIndex;
  osnap: OsnapEngine;
  layers: LayerManager;
  getAllEntities: () => ICadEntity[];
  getSelectedIds: () => Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  setMarqueeBox: (box: { start: Point2D; current: Point2D; isCrossing: boolean } | null) => void;
  getActivePage: () => number;
  getStrokeColor: () => string;
  getZoom: () => number;
  getSnapOptions: () => SnapSearchOptions;
  getMmPerWorldUnit: () => number;
  getActiveStampDefaults: () => { spoolNo: string; jointNo: string; welderId: string };
  onOpenJointWidget?: (entityId: string) => void;
  onRequestTextInput?: (worldPt: Point2D) => void;
  onRequestRender: () => void;
  onLogCli?: (msg: string) => void;
  onSnapChanged?: (snap: SnapPoint | null) => void;
}
