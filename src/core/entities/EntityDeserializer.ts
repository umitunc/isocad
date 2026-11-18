import { ICadEntity, Point2D } from '../interfaces/ICadEntity';
import { StampShapeKind } from '../math/LeaderEdgeAnchor';
import { JointWidgetMeta } from '../../piping-domain/types/PipingModels';
import { CircleEntity } from './CircleEntity';
import { DimensionEntity } from './DimensionEntity';
import { LineEntity } from './LineEntity';
import { PolylineEntity } from './PolylineEntity';
import { RectEntity } from './RectEntity';
import { RevCloudEntity } from './RevCloudEntity';
import { TextEntity } from './TextEntity';
import { WeldStampEntity } from './WeldStampEntity';

export function deserializeCadEntity(raw: Record<string, unknown>): ICadEntity | null {
  const id = String(raw.id ?? '');
  const type = String(raw.type ?? '');
  if (!id || !type) return null;

  const baseOpts = {
    layerId: typeof raw.layerId === 'string' ? raw.layerId : undefined,
    pageNumber: typeof raw.pageNumber === 'number' ? raw.pageNumber : 1,
    strokeColor: typeof raw.strokeColor === 'string' ? raw.strokeColor : '#00e5ff',
    strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : 1.8,
  };

  switch (type) {
    case 'line':
      return new LineEntity(id, raw.p1 as Point2D, raw.p2 as Point2D, {
        ...baseOpts,
        isArrow: Boolean(raw.isArrow),
        dashed: Boolean(raw.dashed),
      });
    case 'polyline':
      return new PolylineEntity(id, (raw.points as Point2D[]) ?? [], {
        ...baseOpts,
        closed: Boolean(raw.closed),
      });
    case 'circle':
      return new CircleEntity(id, raw.center as Point2D, Number(raw.radius ?? 20), baseOpts);
    case 'rect':
      return new RectEntity(
        id,
        Number(raw.x ?? 0),
        Number(raw.y ?? 0),
        Number(raw.width ?? 40),
        Number(raw.height ?? 40),
        baseOpts,
      );
    case 'revcloud':
      return new RevCloudEntity(
        id,
        Number(raw.x ?? 0),
        Number(raw.y ?? 0),
        Number(raw.width ?? 40),
        Number(raw.height ?? 40),
        baseOpts,
      );
    case 'dimension':
      return new DimensionEntity(id, raw.p1 as Point2D, raw.p2 as Point2D, {
        ...baseOpts,
        offset: Number(raw.offset ?? 22),
        mmPerWorldUnit: Number(raw.mmPerWorldUnit ?? (25.4 / 72) * 10),
      });
    case 'text':
      return new TextEntity(id, raw.position as Point2D, String(raw.text ?? ''), {
        ...baseOpts,
        fontSize: Number(raw.fontSize ?? 14),
      });
    case 'weld_stamp':
      return new WeldStampEntity({
        id,
        shapeKind: (raw.shapeKind as StampShapeKind) ?? 'triangle',
        center: raw.center as Point2D,
        width: Number(raw.width ?? 40),
        height: Number(raw.height ?? 40),
        leaderAnchor: raw.leaderAnchor as Point2D,
        hasLeader: raw.hasLeader !== false,
        spoolNo: String(raw.spoolNo ?? ''),
        jointNo: String(raw.jointNo ?? ''),
        welderId: String(raw.welderId ?? ''),
        jointMeta: (raw.jointMeta as Partial<JointWidgetMeta>) ?? undefined,
        ...baseOpts,
      });
    default:
      return null;
  }
}

export function deserializeCadEntities(list: Array<Record<string, unknown>>): ICadEntity[] {
  return list.map(deserializeCadEntity).filter((e): e is ICadEntity => e !== null);
}
