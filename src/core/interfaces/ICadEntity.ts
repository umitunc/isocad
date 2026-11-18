export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type EntityType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'rect'
  | 'triangle'
  | 'hexagon'
  | 'text'
  | 'dimension'
  | 'revcloud'
  | 'weld_stamp';

export type SnapKind = 'END' | 'MID' | 'CEN' | 'INT' | 'PER' | 'QUAD' | 'NEA' | 'ISO';

export interface SnapPoint {
  point: Point2D;
  kind: SnapKind;
  entityId?: string;
}

export interface RenderLinePrimitive {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorRgba: [number, number, number, number];
  width: number;
  screenSpaceWidth?: boolean;
  dashPattern?: [number, number];
}

export interface RenderPolygonPrimitive {
  vertices: Point2D[];
  fillRgba: [number, number, number, number];
}

export interface ICadEntity {
  readonly id: string;
  readonly type: EntityType;
  layerId: string;
  pageNumber: number;
  strokeColor: string;
  strokeWidth: number;
  locked: boolean;
  visible: boolean;

  getBoundingBox(): BoundingBox;
  hitTest(worldPoint: Point2D, toleranceWorld: number): boolean;
  getSnapPoints(): SnapPoint[];
  translate(dx: number, dy: number): void;
  scale(origin: Point2D, sx: number, sy: number): void;
  rotate(origin: Point2D, angleRad: number): void;
  toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[];
  toFillPrimitives?(isSelected: boolean): RenderPolygonPrimitive[];
  clone(): ICadEntity;
  serialize(): Record<string, unknown>;
}
