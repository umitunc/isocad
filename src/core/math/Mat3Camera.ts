import { Point2D } from '../interfaces/ICadEntity';
import { ViewportTransform } from '../interfaces/IRenderEngine';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 24.0;

export function screenToWorld(screen: Point2D, vp: ViewportTransform): Point2D {
  return {
    x: (screen.x - vp.panX) / vp.zoom,
    y: (screen.y - vp.panY) / vp.zoom,
  };
}

export function worldToScreen(world: Point2D, vp: ViewportTransform): Point2D {
  return {
    x: world.x * vp.zoom + vp.panX,
    y: world.y * vp.zoom + vp.panY,
  };
}

export function zoomToPoint(
  vp: ViewportTransform,
  screenCursor: Point2D,
  nextZoom: number,
): ViewportTransform {
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  const worldCursor = screenToWorld(screenCursor, vp);
  return {
    zoom: clamped,
    panX: screenCursor.x - worldCursor.x * clamped,
    panY: screenCursor.y - worldCursor.y * clamped,
  };
}

export function fitBoundsToViewport(
  worldWidth: number,
  worldHeight: number,
  viewWidth: number,
  viewHeight: number,
  paddingPx = 36,
): ViewportTransform {
  if (worldWidth <= 0 || worldHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }
  const availW = Math.max(40, viewWidth - paddingPx * 2);
  const availH = Math.max(40, viewHeight - paddingPx * 2);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(availW / worldWidth, availH / worldHeight)));
  const panX = (viewWidth - worldWidth * zoom) * 0.5;
  const panY = (viewHeight - worldHeight * zoom) * 0.5;
  return { zoom, panX, panY };
}

export function buildClipSpaceMatrix(
  vp: ViewportTransform,
  canvasCssW: number,
  canvasCssH: number,
): Float32Array {
  // Maps world (x, y) -> WebGL NDC (-1..+1, Y flipped so +Y goes down like PDF/Screen)
  const sx = (2 * vp.zoom) / canvasCssW;
  const sy = (-2 * vp.zoom) / canvasCssH;
  const tx = (2 * vp.panX) / canvasCssW - 1;
  const ty = 1 - (2 * vp.panY) / canvasCssH;

  // Column-major 3x3 matrix
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    tx, ty, 1,
  ]);
}
