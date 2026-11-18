import { Point2D, RenderLinePrimitive, RenderPolygonPrimitive } from './ICadEntity';

export interface ToolPointerEvent {
  world: Point2D;
  snapped: Point2D;
  screen: Point2D;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  button: number;
}

export interface ICadTool {
  readonly name: string;
  readonly shortcut: string;
  readonly cursor: string;
  onActivate(): void;
  onDeactivate(): void;
  onPointerDown(evt: ToolPointerEvent): void;
  onPointerMove(evt: ToolPointerEvent): void;
  onPointerUp(evt: ToolPointerEvent): void;
  onDoubleClick?(evt: ToolPointerEvent): void;
  onKeyDown?(key: string, evt: KeyboardEvent): void;
  onCommandInput?(rawInput: string): boolean;
  getPreviewPrimitives(): RenderLinePrimitive[];
  getPreviewPolygons?(): RenderPolygonPrimitive[];
}
