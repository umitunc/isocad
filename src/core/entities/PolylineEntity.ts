import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { distancePointToSegment } from '../math/GeometryIntersections';
import { rotatePoint, scalePoint, vecMid } from '../math/Vec2';
import { BaseCadEntity } from './BaseCadEntity';

export class PolylineEntity extends BaseCadEntity {
  public points: Point2D[];
  public closed: boolean;

  constructor(
    id: string,
    points: Point2D[],
    opts?: {
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
      closed?: boolean;
    },
  ) {
    super(id, 'polyline', opts);
    this.points = points.map((p) => ({ ...p }));
    this.closed = opts?.closed ?? false;
  }

  public getBoundingBox(): BoundingBox {
    if (this.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const count = this.closed ? this.points.length : this.points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      if (distancePointToSegment(worldPoint, a, b).distance <= toleranceWorld) return true;
    }
    return false;
  }

  public getSnapPoints(): SnapPoint[] {
    const snaps: SnapPoint[] = [];
    for (let i = 0; i < this.points.length; i++) {
      snaps.push({ point: { ...this.points[i] }, kind: 'END', entityId: this.id });
      if (i < this.points.length - 1 || this.closed) {
        const next = this.points[(i + 1) % this.points.length];
        snaps.push({ point: vecMid(this.points[i], next), kind: 'MID', entityId: this.id });
      }
    }
    return snaps;
  }

  public translate(dx: number, dy: number): void {
    for (const p of this.points) {
      p.x += dx;
      p.y += dy;
    }
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    this.points = this.points.map((p) => scalePoint(p, origin, sx, sy));
  }

  public rotate(origin: Point2D, angleRad: number): void {
    this.points = this.points.map((p) => rotatePoint(p, origin, angleRad));
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const primitives: RenderLinePrimitive[] = [];
    const count = this.closed ? this.points.length : this.points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      primitives.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, colorRgba, width });
    }
    return primitives;
  }

  public clone(): PolylineEntity {
    return new PolylineEntity(`${this.id}-copy`, this.points, {
      layerId: this.layerId,
      pageNumber: this.pageNumber,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      closed: this.closed,
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
      points: this.points,
      closed: this.closed,
    };
  }
}
