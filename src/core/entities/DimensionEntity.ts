import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { distancePointToSegment } from '../math/GeometryIntersections';
import { rotatePoint, scalePoint } from '../math/Vec2';
import { BaseCadEntity } from './BaseCadEntity';

export class DimensionEntity extends BaseCadEntity {
  public p1: Point2D;
  public p2: Point2D;
  public offset: number;
  public mmPerWorldUnit: number;

  constructor(
    id: string,
    p1: Point2D,
    p2: Point2D,
    opts?: {
      offset?: number;
      mmPerWorldUnit?: number;
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
    },
  ) {
    super(id, 'dimension', {
      layerId: opts?.layerId ?? 'Dimensions',
      strokeColor: opts?.strokeColor ?? '#facc15',
      ...opts,
    });
    this.p1 = { ...p1 };
    this.p2 = { ...p2 };
    this.offset = opts?.offset ?? 22;
    this.mmPerWorldUnit = opts?.mmPerWorldUnit ?? (25.4 / 72) * 10; // default 1:10 scale
  }

  public getMeasuredMm(): number {
    return Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y) * this.mmPerWorldUnit;
  }

  public getDimensionLinePoints(): { d1: Point2D; d2: Point2D; mid: Point2D } {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const d1 = { x: this.p1.x + nx * this.offset, y: this.p1.y + ny * this.offset };
    const d2 = { x: this.p2.x + nx * this.offset, y: this.p2.y + ny * this.offset };
    return { d1, d2, mid: { x: (d1.x + d2.x) * 0.5, y: (d1.y + d2.y) * 0.5 } };
  }

  public getBoundingBox(): BoundingBox {
    const { d1, d2 } = this.getDimensionLinePoints();
    const xs = [this.p1.x, this.p2.x, d1.x, d2.x];
    const ys = [this.p1.y, this.p2.y, d1.y, d2.y];
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const { d1, d2 } = this.getDimensionLinePoints();
    return (
      distancePointToSegment(worldPoint, d1, d2).distance <= toleranceWorld ||
      distancePointToSegment(worldPoint, this.p1, d1).distance <= toleranceWorld ||
      distancePointToSegment(worldPoint, this.p2, d2).distance <= toleranceWorld
    );
  }

  public getSnapPoints(): SnapPoint[] {
    return [
      { point: { ...this.p1 }, kind: 'END', entityId: this.id },
      { point: { ...this.p2 }, kind: 'END', entityId: this.id },
    ];
  }

  public translate(dx: number, dy: number): void {
    this.p1.x += dx;
    this.p1.y += dy;
    this.p2.x += dx;
    this.p2.y += dy;
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    this.p1 = scalePoint(this.p1, origin, sx, sy);
    this.p2 = scalePoint(this.p2, origin, sx, sy);
  }

  public rotate(origin: Point2D, angleRad: number): void {
    this.p1 = rotatePoint(this.p1, origin, angleRad);
    this.p2 = rotatePoint(this.p2, origin, angleRad);
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.0 : this.strokeWidth;
    const { d1, d2 } = this.getDimensionLinePoints();
    return [
      { x1: this.p1.x, y1: this.p1.y, x2: d1.x, y2: d1.y, colorRgba, width: 1.0, dashPattern: [3, 3] },
      { x1: this.p2.x, y1: this.p2.y, x2: d2.x, y2: d2.y, colorRgba, width: 1.0, dashPattern: [3, 3] },
      { x1: d1.x, y1: d1.y, x2: d2.x, y2: d2.y, colorRgba, width },
    ];
  }

  public clone(): DimensionEntity {
    return new DimensionEntity(`${this.id}-copy`, this.p1, this.p2, {
      offset: this.offset,
      mmPerWorldUnit: this.mmPerWorldUnit,
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
      layerId: this.layerId,
      pageNumber: this.pageNumber,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      p1: this.p1,
      p2: this.p2,
      offset: this.offset,
      mmPerWorldUnit: this.mmPerWorldUnit,
      measuredMm: this.getMeasuredMm(),
    };
  }
}
