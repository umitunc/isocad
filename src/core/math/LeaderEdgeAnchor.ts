import { Point2D } from '../interfaces/ICadEntity';
import { distancePointToSegment } from './GeometryIntersections';

export type StampShapeKind = 'circle' | 'triangle' | 'rect' | 'hexagon';

/**
 * Computes the exact edge connection point on a weld/spool stamp shape
 * facing toward the fixed leader anchor point on the piping drawing.
 */
export function computeLeaderEdgeAnchor(
  shapeKind: StampShapeKind,
  center: Point2D,
  width: number,
  height: number,
  leaderAnchor: Point2D,
): Point2D {
  const halfW = Math.max(1, width * 0.5);
  const halfH = Math.max(1, height * 0.5);

  if (shapeKind === 'circle') {
    const r = Math.min(halfW, halfH);
    const angle = Math.atan2(leaderAnchor.y - center.y, leaderAnchor.x - center.x);
    return {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    };
  }

  if (shapeKind === 'triangle') {
    const top: Point2D = { x: center.x, y: center.y - halfH };
    const bottomLeft: Point2D = { x: center.x - halfW, y: center.y + halfH };
    const bottomRight: Point2D = { x: center.x + halfW, y: center.y + halfH };
    const edges: Array<[Point2D, Point2D]> = [
      [top, bottomRight],
      [bottomRight, bottomLeft],
      [bottomLeft, top],
    ];
    let bestPt = top;
    let bestDist = Infinity;
    for (const [a, b] of edges) {
      const res = distancePointToSegment(leaderAnchor, a, b);
      if (res.distance < bestDist) {
        bestDist = res.distance;
        bestPt = res.closest;
      }
    }
    return bestPt;
  }

  if (shapeKind === 'hexagon') {
    const verts: Point2D[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      verts.push({
        x: center.x + Math.cos(ang) * halfW,
        y: center.y + Math.sin(ang) * halfH,
      });
    }
    let bestPt = verts[0];
    let bestDist = Infinity;
    for (let i = 0; i < 6; i++) {
      const res = distancePointToSegment(leaderAnchor, verts[i], verts[(i + 1) % 6]);
      if (res.distance < bestDist) {
        bestDist = res.distance;
        bestPt = res.closest;
      }
    }
    return bestPt;
  }

  // Rectangle ray-slab intersection from center toward leaderAnchor
  const dx = leaderAnchor.x - center.x;
  const dy = leaderAnchor.y - center.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: center.x, y: center.y - halfH };
  }
  const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return {
    x: center.x + dx * t,
    y: center.y + dy * t,
  };
}
