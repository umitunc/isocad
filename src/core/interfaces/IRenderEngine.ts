import { Point2D, RenderLinePrimitive, RenderPolygonPrimitive, SnapPoint } from './ICadEntity';

export interface ViewportTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface PdfBackgroundTexture {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  canvas: HTMLCanvasElement;
  version: number;
}

export interface RenderFramePayload {
  viewport: ViewportTransform;
  pdfPage: PdfBackgroundTexture | null;
  lines: RenderLinePrimitive[];
  polygons: RenderPolygonPrimitive[];
  snapIndicator: SnapPoint | null;
  gridVisible: boolean;
  isometricGrid: boolean;
}

export interface IRenderEngine {
  mount(canvas: HTMLCanvasElement): void;
  resize(widthCss: number, heightCss: number, dpr: number): void;
  render(frame: RenderFramePayload): void;
  screenToWorld(screenPt: Point2D, viewport: ViewportTransform): Point2D;
  worldToScreen(worldPt: Point2D, viewport: ViewportTransform): Point2D;
  dispose(): void;
}
