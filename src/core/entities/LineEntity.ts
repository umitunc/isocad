import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { distancePointToSegment } from '../math/GeometryIntersections';
import { rotatePoint, scalePoint, vecMid } from '../math/Vec2';
import { BaseCadEntity } from './BaseCadEntity';

export class LineEntity extends BaseCadEntity {
  public p1: Point2D;
  public p2: Point2D;
  public isArrow: boolean;
  public dashed: boolean;

  constructor(
    id: string,
    p1: Point2D,
    p2: Point2D,
    opts?: {
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
      isArrow?: boolean;
      dashed?: boolean;
    },
  ) {
    super(id, 'line', opts);
    this.p1 = { ...p1 };
    this.p2 = { ...p2 };
    this.isArrow = opts?.isArrow ?? false;
    this.dashed = opts?.dashed ?? false;
  }

  public getBoundingBox(): BoundingBox {
    return {
      minX: Math.min(this.p1.x, this.p2.x),
      minY: Math.min(this.p1.y, this.p2.y),
      maxX: Math.max(this.p1.x, this.p2.x),
      maxY: Math.max(this.p1.y, this.p2.y),
    };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    return distancePointToSegment(worldPoint, this.p1, this.p2).distance <= toleranceWorld;
  }

  public getSnapPoints(): SnapPoint[] {
    return [
      { point: { ...this.p1 }, kind: 'END', entityId: this.id },
      { point: { ...this.p2 }, kind: 'END', entityId: this.id },
      { point: vecMid(this.p1, this.p2), kind: 'MID', entityId: this.id },
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
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const dashPattern: [number, number] | undefined = this.dashed ? [6, 4] : undefined;
    const primitives: RenderLinePrimitive[] = [
      {
        x1: this.p1.x,
        y1: this.p1.y,
        x2: this.p2.x,
        y2: this.p2.y,
        colorRgba,
        width,
        dashPattern,
      },
    ];

    if (this.isArrow) {
      const angle = Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);
      const headLen = Math.max(8, Math.min(18, Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y) * 0.25));
      const a1 = angle + Math.PI * 0.82;
      const a2 = angle - Math.PI * 0.82;
      primitives.push(
        {
          x1: this.p2.x,
          y1: this.p2.y,
          x2: this.p2.x + Math.cos(a1) * headLen,
          y2: this.p2.y + Math.sin(a1) * headLen,
          colorRgba,
          width,
        },
        {
          x1: this.p2.x,
          y1: this.p2.y,
          x2: this.p2.x + Math.cos(a2) * headLen,
          y2: this.p2.y + Math.sin(a2) * headLen,
          colorRgba,
          width,
        },
      );
    }

    return primitives;
  }

  public clone(): LineEntity {
    return new LineEntity(`${this.id}-copy`, this.p1, this.p2, {
      layerId: this.layerId,
      pageNumber: this.pageNumber,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      isArrow: this.isArrow,
      dashed: this.dashed,
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
      isArrow: this.isArrow,
      dashed: this.dashed,
    };
  }
}
