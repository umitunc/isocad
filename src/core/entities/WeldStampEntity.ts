import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { distancePointToSegment } from '../math/GeometryIntersections';
import { computeLeaderEdgeAnchor, StampShapeKind } from '../math/LeaderEdgeAnchor';
import { JointWidgetMeta } from '../../piping-domain/types/PipingModels';
import { BaseCadEntity } from './BaseCadEntity';

export interface WeldStampParams {
  id: string;
  shapeKind: StampShapeKind;
  center: Point2D;
  width: number;
  height: number;
  leaderAnchor: Point2D;
  hasLeader?: boolean;
  spoolNo?: string;
  jointNo?: string;
  welderId?: string;
  jointMeta?: Partial<JointWidgetMeta>;
  layerId?: string;
  pageNumber?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export class WeldStampEntity extends BaseCadEntity {
  public shapeKind: StampShapeKind;
  public center: Point2D;
  public width: number;
  public height: number;
  public leaderAnchor: Point2D;
  public hasLeader: boolean;
  public spoolNo: string;
  public jointNo: string;
  public welderId: string;
  public jointMeta: JointWidgetMeta;

  constructor(params: WeldStampParams) {
    const defaultLayer =
      params.shapeKind === 'triangle'
        ? 'Welds-Field'
        : params.shapeKind === 'circle'
          ? 'Welds-Shop'
          : params.shapeKind === 'rect'
            ? 'Spools'
            : 'Supports';
    const defaultColor =
      params.shapeKind === 'triangle'
        ? '#ef4444'
        : params.shapeKind === 'circle'
          ? '#f59e0b'
          : params.shapeKind === 'rect'
            ? '#22c55e'
            : '#a855f7';

    super(params.id, 'weld_stamp', {
      layerId: params.layerId ?? defaultLayer,
      pageNumber: params.pageNumber ?? 1,
      strokeColor: params.strokeColor ?? defaultColor,
      strokeWidth: params.strokeWidth ?? 2.0,
    });

    this.shapeKind = params.shapeKind;
    this.center = { ...params.center };
    this.width = Math.max(24, params.width);
    this.height = Math.max(24, params.height);
    this.leaderAnchor = { ...params.leaderAnchor };
    this.hasLeader = params.hasLeader ?? true;
    this.spoolNo = params.spoolNo ?? '';
    this.jointNo = params.jointNo ?? '';
    this.welderId = params.welderId ?? '';
    const defaultJointType: 'F' | 'S' | '' =
      params.shapeKind === 'triangle' ? 'F' : params.shapeKind === 'circle' ? 'S' : '';

    this.jointMeta = {
      shapeId: params.id,
      shapeType: params.shapeKind,
      typeOfJoint: params.jointMeta?.typeOfJoint ?? defaultJointType,
      typeOfWelds: params.jointMeta?.typeOfWelds ?? 'BW',
      jointNo: params.jointMeta?.jointNo ?? this.jointNo,
      drawJointNo:
        params.jointMeta?.drawJointNo ??
        (defaultJointType && this.jointNo ? `${defaultJointType}${this.jointNo}` : this.jointNo),
      weldingDate: params.jointMeta?.weldingDate ?? '',
      spoolNo1: params.jointMeta?.spoolNo1 ?? this.spoolNo,
      spoolNo2: params.jointMeta?.spoolNo2 ?? this.spoolNo,
      poseNo1: params.jointMeta?.poseNo1 ?? '',
      poseNo2: params.jointMeta?.poseNo2 ?? '',
      member1: params.jointMeta?.member1 ?? '',
      member2: params.jointMeta?.member2 ?? '',
      material: params.jointMeta?.material ?? '',
      dia1: params.jointMeta?.dia1 ?? '',
      dia2: params.jointMeta?.dia2 ?? '',
      nps1: params.jointMeta?.nps1 ?? '',
      nps2: params.jointMeta?.nps2 ?? '',
      thickness1: params.jointMeta?.thickness1 ?? '',
      thickness2: params.jointMeta?.thickness2 ?? '',
      danCode1: params.jointMeta?.danCode1 ?? '',
      danCode2: params.jointMeta?.danCode2 ?? '',
      welderId: params.jointMeta?.welderId ?? this.welderId,
    };
  }

  public getPrimaryLabel(): string {
    if (this.shapeKind === 'rect') {
      return this.spoolNo || this.jointMeta.spoolNo1 || 'SPOOL';
    }
    return this.jointMeta.drawJointNo || this.jointNo || 'J-?';
  }

  public getSecondaryLabel(): string {
    return this.welderId || this.jointMeta.welderId || '';
  }

  public getEdgeConnectionPoint(): Point2D {
    return computeLeaderEdgeAnchor(
      this.shapeKind,
      this.center,
      this.width,
      this.height,
      this.leaderAnchor,
    );
  }

  public getBoundingBox(): BoundingBox {
    const hw = this.width * 0.5;
    const hh = this.height * 0.5;
    const minX = this.hasLeader
      ? Math.min(this.center.x - hw, this.leaderAnchor.x)
      : this.center.x - hw;
    const minY = this.hasLeader
      ? Math.min(this.center.y - hh, this.leaderAnchor.y)
      : this.center.y - hh;
    const maxX = this.hasLeader
      ? Math.max(this.center.x + hw, this.leaderAnchor.x)
      : this.center.x + hw;
    const maxY = this.hasLeader
      ? Math.max(this.center.y + hh, this.leaderAnchor.y)
      : this.center.y + hh;
    return { minX, minY, maxX, maxY };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const hw = this.width * 0.5 + toleranceWorld;
    const hh = this.height * 0.5 + toleranceWorld;
    const insideShape =
      worldPoint.x >= this.center.x - hw &&
      worldPoint.x <= this.center.x + hw &&
      worldPoint.y >= this.center.y - hh &&
      worldPoint.y <= this.center.y + hh;
    if (insideShape) return true;
    if (this.hasLeader) {
      const edge = this.getEdgeConnectionPoint();
      return distancePointToSegment(worldPoint, this.leaderAnchor, edge).distance <= toleranceWorld;
    }
    return false;
  }

  public getSnapPoints(): SnapPoint[] {
    return [
      { point: { ...this.center }, kind: 'CEN', entityId: this.id },
      { point: { ...this.leaderAnchor }, kind: 'END', entityId: this.id },
    ];
  }

  public translate(dx: number, dy: number): void {
    // Only the stamp moves; leaderAnchor remains pinned to the weld point on the pipe!
    this.center.x += dx;
    this.center.y += dy;
  }

  public scale(_origin: Point2D, sx: number, sy: number): void {
    this.width = Math.max(20, this.width * Math.abs(sx));
    this.height = Math.max(20, this.height * Math.abs(sy));
  }

  public rotate(_origin: Point2D, _angleRad: number): void {
    // Stamp orientation remains upright for engineering readability
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const out: RenderLinePrimitive[] = [];
    const hw = this.width * 0.5;
    const hh = this.height * 0.5;

    if (this.hasLeader) {
      const edge = this.getEdgeConnectionPoint();
      out.push({
        x1: this.leaderAnchor.x,
        y1: this.leaderAnchor.y,
        x2: edge.x,
        y2: edge.y,
        colorRgba,
        width: Math.max(1.4, width * 0.85),
      });
    }

    if (this.shapeKind === 'circle') {
      const r = Math.min(hw, hh);
      const segs = 36;
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        out.push({
          x1: this.center.x + Math.cos(a1) * r,
          y1: this.center.y + Math.sin(a1) * r,
          x2: this.center.x + Math.cos(a2) * r,
          y2: this.center.y + Math.sin(a2) * r,
          colorRgba,
          width,
        });
      }
    } else if (this.shapeKind === 'triangle') {
      const top = { x: this.center.x, y: this.center.y - hh };
      const bl = { x: this.center.x - hw, y: this.center.y + hh };
      const br = { x: this.center.x + hw, y: this.center.y + hh };
      out.push(
        { x1: top.x, y1: top.y, x2: br.x, y2: br.y, colorRgba, width },
        { x1: br.x, y1: br.y, x2: bl.x, y2: bl.y, colorRgba, width },
        { x1: bl.x, y1: bl.y, x2: top.x, y2: top.y, colorRgba, width },
      );
    } else if (this.shapeKind === 'hexagon') {
      const verts: Point2D[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        verts.push({
          x: this.center.x + Math.cos(ang) * hw,
          y: this.center.y + Math.sin(ang) * hh,
        });
      }
      for (let i = 0; i < 6; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % 6];
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, colorRgba, width });
      }
    } else {
      const tl = { x: this.center.x - hw, y: this.center.y - hh };
      const tr = { x: this.center.x + hw, y: this.center.y - hh };
      const br = { x: this.center.x + hw, y: this.center.y + hh };
      const bl = { x: this.center.x - hw, y: this.center.y + hh };
      out.push(
        { x1: tl.x, y1: tl.y, x2: tr.x, y2: tr.y, colorRgba, width },
        { x1: tr.x, y1: tr.y, x2: br.x, y2: br.y, colorRgba, width },
        { x1: br.x, y1: br.y, x2: bl.x, y2: bl.y, colorRgba, width },
        { x1: bl.x, y1: bl.y, x2: tl.x, y2: tl.y, colorRgba, width },
      );
    }

    // Dual-compartment horizontal divider if welderId exists
    if (this.getSecondaryLabel()) {
      const pad = hw * 0.35;
      const divY = this.shapeKind === 'triangle' ? this.center.y + hh * 0.15 : this.center.y;
      out.push({
        x1: this.center.x - hw + pad,
        y1: divY,
        x2: this.center.x + hw - pad,
        y2: divY,
        colorRgba,
        width: Math.max(1.2, width * 0.75),
      });
    }

    return out;
  }

  public clone(): WeldStampEntity {
    return new WeldStampEntity({
      id: `${this.id}-copy`,
      shapeKind: this.shapeKind,
      center: this.center,
      width: this.width,
      height: this.height,
      leaderAnchor: this.leaderAnchor,
      hasLeader: this.hasLeader,
      spoolNo: this.spoolNo,
      jointNo: this.jointNo,
      welderId: this.welderId,
      jointMeta: { ...this.jointMeta },
      layerId: this.layerId,
      pageNumber: this.pageNumber,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
    });
  }

  public serialize(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      shapeKind: this.shapeKind,
      layerId: this.layerId,
      pageNumber: this.pageNumber,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      center: this.center,
      width: this.width,
      height: this.height,
      leaderAnchor: this.leaderAnchor,
      hasLeader: this.hasLeader,
      spoolNo: this.spoolNo,
      jointNo: this.jointNo,
      welderId: this.welderId,
      jointMeta: this.jointMeta,
    };
  }
}
