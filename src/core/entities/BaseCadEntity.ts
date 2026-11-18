import {
  BoundingBox,
  EntityType,
  ICadEntity,
  Point2D,
  RenderLinePrimitive,
  SnapPoint,
} from '../interfaces/ICadEntity';
import { hexToRgba } from '../math/GeometryIntersections';

export abstract class BaseCadEntity implements ICadEntity {
  public layerId: string;
  public pageNumber: number;
  public strokeColor: string;
  public strokeWidth: number;
  public locked: boolean;
  public visible: boolean;

  constructor(
    public readonly id: string,
    public readonly type: EntityType,
    opts?: {
      layerId?: string;
      pageNumber?: number;
      strokeColor?: string;
      strokeWidth?: number;
      locked?: boolean;
      visible?: boolean;
    },
  ) {
    this.layerId = opts?.layerId ?? '0';
    this.pageNumber = opts?.pageNumber ?? 1;
    this.strokeColor = opts?.strokeColor ?? '#00e5ff';
    this.strokeWidth = opts?.strokeWidth ?? 1.8;
    this.locked = opts?.locked ?? false;
    this.visible = opts?.visible ?? true;
  }

  protected resolveColor(isSelected: boolean, isHovered: boolean): [number, number, number, number] {
    if (isSelected) return [0.0, 0.9, 1.0, 1.0];
    if (isHovered) return [1.0, 0.72, 0.25, 1.0];
    return hexToRgba(this.strokeColor, 1.0);
  }

  abstract getBoundingBox(): BoundingBox;
  abstract hitTest(worldPoint: Point2D, toleranceWorld: number): boolean;
  abstract getSnapPoints(): SnapPoint[];
  abstract translate(dx: number, dy: number): void;
  abstract scale(origin: Point2D, sx: number, sy: number): void;
  abstract rotate(origin: Point2D, angleRad: number): void;
  abstract toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[];
  abstract clone(): ICadEntity;
  abstract serialize(): Record<string, unknown>;
}
