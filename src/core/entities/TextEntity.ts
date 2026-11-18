import { BoundingBox, Point2D, RenderLinePrimitive, SnapPoint } from '../interfaces/ICadEntity';
import { BaseCadEntity } from './BaseCadEntity';

export class TextEntity extends BaseCadEntity {
  public position: Point2D;
  public text: string;
  public fontSize: number;

  constructor(
    id: string,
    position: Point2D,
    text: string,
    opts?: {
      fontSize?: number;
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
    },
  ) {
    super(id, 'text', opts);
    this.position = { ...position };
    this.text = text;
    this.fontSize = opts?.fontSize ?? 14;
  }

  public getBoundingBox(): BoundingBox {
    const approxW = Math.max(24, this.text.length * this.fontSize * 0.6);
    const approxH = this.fontSize * 1.3;
    return {
      minX: this.position.x,
      minY: this.position.y - approxH * 0.5,
      maxX: this.position.x + approxW,
      maxY: this.position.y + approxH * 0.5,
    };
  }

  public hitTest(worldPoint: Point2D, toleranceWorld: number): boolean {
    const b = this.getBoundingBox();
    return (
      worldPoint.x >= b.minX - toleranceWorld &&
      worldPoint.x <= b.maxX + toleranceWorld &&
      worldPoint.y >= b.minY - toleranceWorld &&
      worldPoint.y <= b.maxY + toleranceWorld
    );
  }

  public getSnapPoints(): SnapPoint[] {
    return [{ point: { ...this.position }, kind: 'END', entityId: this.id }];
  }

  public translate(dx: number, dy: number): void {
    this.position.x += dx;
    this.position.y += dy;
  }

  public scale(origin: Point2D, sx: number, sy: number): void {
    this.position.x = origin.x + (this.position.x - origin.x) * sx;
    this.position.y = origin.y + (this.position.y - origin.y) * sy;
    this.fontSize = Math.max(8, this.fontSize * ((Math.abs(sx) + Math.abs(sy)) * 0.5));
  }

  public rotate(_origin: Point2D, _angleRad: number): void {
    // Text stays upright for engineering legibility
  }

  public toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[] {
    if (!isSelected && !isHovered) return [];
    const colorRgba = this.resolveColor(isSelected, isHovered);
    const b = this.getBoundingBox();
    return [
      { x1: b.minX, y1: b.minY, x2: b.maxX, y2: b.minY, colorRgba, width: 1, screenSpaceWidth: true, dashPattern: [4, 3] },
      { x1: b.maxX, y1: b.minY, x2: b.maxX, y2: b.maxY, colorRgba, width: 1, screenSpaceWidth: true, dashPattern: [4, 3] },
      { x1: b.maxX, y1: b.maxY, x2: b.minX, y2: b.maxY, colorRgba, width: 1, screenSpaceWidth: true, dashPattern: [4, 3] },
      { x1: b.minX, y1: b.maxY, x2: b.minX, y2: b.minY, colorRgba, width: 1, screenSpaceWidth: true, dashPattern: [4, 3] },
    ];
  }

  public clone(): TextEntity {
    return new TextEntity(`${this.id}-copy`, this.position, this.text, {
      fontSize: this.fontSize,
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
      position: this.position,
      text: this.text,
      fontSize: this.fontSize,
    };
  }
}
