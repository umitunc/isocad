import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { rotatePoint, scalePoint } from '../math/Vec2';
import { BaseCadEntity } from './BaseCadEntity';

export class CircleEntity extends BaseCadEntity {
  public center: Point2D;
  public radius: number;

  constructor(
    id: string,
    center: Point2D,
    radius: number,
    opts?: {
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
    },
  ) {
    super(id, 'circle', opts);
    this.center = { ...center };
    this.radius = Math.max(1, radius);
  }

  public getBoundingBox(): BoundingBox {
    return {
      minX: this.center.x - this.radius,
      minY: this.center.y - this.radius,
      maxX: this.center.x + this.radius,
      maxY: this.center.y + this.radius,
    };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const dist = Math.hypot(worldPoint.x - this.center.x, worldPoint.y - this.center.y);
    return Math.abs(dist - this.radius) <= toleranceWorld;
  }

  public getSnapPoints(): SnapPoint[] {
    return [
      { point: { ...this.center }, kind: 'CEN', entityId: this.id },
      { point: { x: this.center.x + this.radius, y: this.center.y }, kind: 'QUAD', entityId: this.id },
      { point: { x: this.center.x - this.radius, y: this.center.y }, kind: 'QUAD', entityId: this.id },
      { point: { x: this.center.x, y: this.center.y + this.radius }, kind: 'QUAD', entityId: this.id },
      { point: { x: this.center.x, y: this.center.y - this.radius }, kind: 'QUAD', entityId: this.id },
    ];
  }

  public translate(dx: number, dy: number): void {
    this.center.x += dx;
    this.center.y += dy;
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    this.center = scalePoint(this.center, origin, sx, sy);
    this.radius *= (Math.abs(sx) + Math.abs(sy)) * 0.5;
  }

  public rotate(origin: Point2D, angleRad: number): void {
    this.center = rotatePoint(this.center, origin, angleRad);
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const segments = 48;
    const out: RenderLinePrimitive[] = [];
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      out.push({
        x1: this.center.x + Math.cos(a1) * this.radius,
        y1: this.center.y + Math.sin(a1) * this.radius,
        x2: this.center.x + Math.cos(a2) * this.radius,
        y2: this.center.y + Math.sin(a2) * this.radius,
        colorRgba,
        width,
      });
    }
    return out;
  }

  public clone(): CircleEntity {
    return new CircleEntity(`${this.id}-copy`, this.center, this.radius, {
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
      center: this.center,
      radius: this.radius,
    };
  }
}
