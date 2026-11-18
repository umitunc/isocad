import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { distancePointToSegment } from '../math/GeometryIntersections';
import { rotatePoint, scalePoint, vecMid } from '../math/Vec2';
import { BaseCadEntity } from './BaseCadEntity';

export class RectEntity extends BaseCadEntity {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    opts?: {
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
    },
  ) {
    super(id, 'rect', opts);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  private getCorners(): [Point2D, Point2D, Point2D, Point2D] {
    return [
      { x: this.x, y: this.y },
      { x: this.x + this.width, y: this.y },
      { x: this.x + this.width, y: this.y + this.height },
      { x: this.x, y: this.y + this.height },
    ];
  }

  public getBoundingBox(): BoundingBox {
    return {
      minX: Math.min(this.x, this.x + this.width),
      minY: Math.min(this.y, this.y + this.height),
      maxX: Math.max(this.x, this.x + this.width),
      maxY: Math.max(this.y, this.y + this.height),
    };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const corners = this.getCorners();
    for (let i = 0; i < 4; i++) {
      if (distancePointToSegment(worldPoint, corners[i], corners[(i + 1) % 4]).distance <= toleranceWorld) {
        return true;
      }
    }
    return false;
  }

  public getSnapPoints(): SnapPoint[] {
    const corners = this.getCorners();
    const snaps: SnapPoint[] = [];
    for (let i = 0; i < 4; i++) {
      snaps.push({ point: corners[i], kind: 'END', entityId: this.id });
      snaps.push({ point: vecMid(corners[i], corners[(i + 1) % 4]), kind: 'MID', entityId: this.id });
    }
    snaps.push({
      point: { x: this.x + this.width * 0.5, y: this.y + this.height * 0.5 },
      kind: 'CEN',
      entityId: this.id,
    });
    return snaps;
  }

  public translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    const tl = scalePoint({ x: this.x, y: this.y }, origin, sx, sy);
    const br = scalePoint({ x: this.x + this.width, y: this.y + this.height }, origin, sx, sy);
    this.x = Math.min(tl.x, br.x);
    this.y = Math.min(tl.y, br.y);
    this.width = Math.abs(br.x - tl.x);
    this.height = Math.abs(br.y - tl.y);
  }

  public rotate(origin: Point2D, angleRad: number): void {
    const center = rotatePoint(
      { x: this.x + this.width * 0.5, y: this.y + this.height * 0.5 },
      origin,
      angleRad,
    );
    this.x = center.x - this.width * 0.5;
    this.y = center.y - this.height * 0.5;
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const c = this.getCorners();
    return [
      { x1: c[0].x, y1: c[0].y, x2: c[1].x, y2: c[1].y, colorRgba, width },
      { x1: c[1].x, y1: c[1].y, x2: c[2].x, y2: c[2].y, colorRgba, width },
      { x1: c[2].x, y1: c[2].y, x2: c[3].x, y2: c[3].y, colorRgba, width },
      { x1: c[3].x, y1: c[3].y, x2: c[0].x, y2: c[0].y, colorRgba, width },
    ];
  }

  public clone(): RectEntity {
    return new RectEntity(`${this.id}-copy`, this.x, this.y, this.width, this.height, {
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
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }
}
