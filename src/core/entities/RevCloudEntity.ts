import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { BaseCadEntity } from './BaseCadEntity';

export class RevCloudEntity extends BaseCadEntity {
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
    super(id, 'revcloud', {
      layerId: opts?.layerId ?? 'Redline',
      strokeColor: opts?.strokeColor ?? '#f43f5e',
      ...opts,
    });
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
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
    const b = this.getBoundingBox();
    const nearX =
      Math.abs(worldPoint.x - b.minX) <= toleranceWorld ||
      Math.abs(worldPoint.x - b.maxX) <= toleranceWorld;
    const nearY =
      Math.abs(worldPoint.y - b.minY) <= toleranceWorld ||
      Math.abs(worldPoint.y - b.maxY) <= toleranceWorld;
    return (
      (nearX && worldPoint.y >= b.minY - toleranceWorld && worldPoint.y <= b.maxY + toleranceWorld) ||
      (nearY && worldPoint.x >= b.minX - toleranceWorld && worldPoint.x <= b.maxX + toleranceWorld)
    );
  }

  public getSnapPoints(): SnapPoint[] {
    return [
      {
        point: { x: this.x + this.width * 0.5, y: this.y + this.height * 0.5 },
        kind: 'CEN',
        entityId: this.id,
      },
    ];
  }

  public translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    this.x = origin.x + (this.x - origin.x) * sx;
    this.y = origin.y + (this.y - origin.y) * sy;
    this.width *= sx;
    this.height *= sy;
  }

  public rotate(_origin: Point2D, _angleRad: number): void {
    // Axis-aligned rev cloud
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const width = isSelected ? this.strokeWidth + 1.2 : this.strokeWidth;
    const b = this.getBoundingBox();
    const perimeter = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    const out: RenderLinePrimitive[] = [];
    const arcChord = Math.max(12, Math.min(24, Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.2));

    for (let e = 0; e < 4; e++) {
      const a = perimeter[e];
      const c = perimeter[(e + 1) % 4];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const len = Math.hypot(dx, dy);
      const count = Math.max(2, Math.round(len / arcChord));
      const nx = dy / Math.max(1e-6, len);
      const ny = -dx / Math.max(1e-6, len);

      for (let i = 0; i < count; i++) {
        const t0 = i / count;
        const t1 = (i + 1) / count;
        const tm = (t0 + t1) * 0.5;
        const p0 = { x: a.x + dx * t0, y: a.y + dy * t0 };
        const p1 = { x: a.x + dx * t1, y: a.y + dy * t1 };
        const bulge = Math.min(8, (len / count) * 0.45);
        const pm = { x: a.x + dx * tm + nx * bulge, y: a.y + dy * tm + ny * bulge };
        out.push(
          { x1: p0.x, y1: p0.y, x2: pm.x, y2: pm.y, colorRgba, width },
          { x1: pm.x, y1: pm.y, x2: p1.x, y2: p1.y, colorRgba, width },
        );
      }
    }
    return out;
  }

  public clone(): RevCloudEntity {
    return new RevCloudEntity(`${this.id}-copy`, this.x, this.y, this.width, this.height, {
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
