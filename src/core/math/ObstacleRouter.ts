import { CircleEntity } from '../entities/CircleEntity';
import { RectEntity } from '../entities/RectEntity';
import { RevCloudEntity } from '../entities/RevCloudEntity';
import { WeldStampEntity } from '../entities/WeldStampEntity';
import { ICadEntity, Point2D } from '../interfaces/ICadEntity';

type Obstacle =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'box'; minX: number; minY: number; maxX: number; maxY: number };

function extractObstacles(entities: ICadEntity[], pageNumber: number): Obstacle[] {
  const out: Obstacle[] = [];
  for (const e of entities) {
    if (!e.visible || e.pageNumber !== pageNumber) continue;
    if (e.type === 'circle') {
      const c = e as CircleEntity;
      if (c.radius >= 2) {
        out.push({ kind: 'circle', cx: c.center.x, cy: c.center.y, r: c.radius });
      }
    } else if (e.type === 'rect' || e.type === 'revcloud') {
      const r = e as RectEntity | RevCloudEntity;
      const minX = Math.min(r.x, r.x + r.width);
      const maxX = Math.max(r.x, r.x + r.width);
      const minY = Math.min(r.y, r.y + r.height);
      const maxY = Math.max(r.y, r.y + r.height);
      if (maxX - minX >= 2 && maxY - minY >= 2) {
        out.push({ kind: 'box', minX, minY, maxX, maxY });
      }
    } else if (e.type === 'weld_stamp') {
      const s = e as WeldStampEntity;
      const hw = s.width * 0.5;
      const hh = s.height * 0.5;
      out.push({
        kind: 'box',
        minX: s.center.x - hw,
        minY: s.center.y - hh,
        maxX: s.center.x + hw,
        maxY: s.center.y + hh,
      });
    }
  }
  return out;
}

function pointStrictlyInsideObstacle(pt: Point2D, obs: Obstacle): boolean {
  const eps = 0.5;
  if (obs.kind === 'circle') {
    const rCheck = Math.max(0.5, obs.r - eps);
    return Math.hypot(pt.x - obs.cx, pt.y - obs.cy) < rCheck - 1e-3;
  }
  return (
    pt.x > obs.minX + eps &&
    pt.x < obs.maxX - eps &&
    pt.y > obs.minY + eps &&
    pt.y < obs.maxY - eps
  );
}

function segmentIntersectsObstacleInterior(a: Point2D, b: Point2D, obs: Obstacle): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return false;

  const eps = 0.5;
  if (obs.kind === 'circle') {
    const rCheck = Math.max(0.5, obs.r - eps);
    const t = Math.max(
      0,
      Math.min(1, ((obs.cx - a.x) * dx + (obs.cy - a.y) * dy) / lenSq),
    );
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return Math.hypot(px - obs.cx, py - obs.cy) < rCheck - 1e-3;
  }

  // Liang-Barsky slab test against slightly inset box interior
  const ix1 = obs.minX + eps;
  const ix2 = obs.maxX - eps;
  const iy1 = obs.minY + eps;
  const iy2 = obs.maxY - eps;
  if (ix2 <= ix1 || iy2 <= iy1) return false;

  let tMin = 0;
  let tMax = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - ix1, ix2 - a.x, a.y - iy1, iy2 - a.y];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] <= 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > tMax) return false;
        if (r > tMin) tMin = r;
      } else {
        if (r < tMin) return false;
        if (r < tMax) tMax = r;
      }
    }
  }
  return tMax > tMin + 1e-4;
}

function obstaclePerimeterNodes(obs: Obstacle, padding: number): Point2D[] {
  if (obs.kind === 'circle') {
    // Circumscribed 8-gon keeps all edges strictly outside radius + padding
    const n = 8;
    const vr = (obs.r + padding) / Math.cos(Math.PI / n);
    const pts: Point2D[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i * 2 * Math.PI) / n;
      pts.push({
        x: obs.cx + vr * Math.cos(ang),
        y: obs.cy + vr * Math.sin(ang),
      });
    }
    return pts;
  }
  return [
    { x: obs.minX - padding, y: obs.minY - padding },
    { x: obs.maxX + padding, y: obs.minY - padding },
    { x: obs.maxX + padding, y: obs.maxY + padding },
    { x: obs.minX - padding, y: obs.maxY + padding },
  ];
}

/**
 * Computes the shortest obstacle-avoiding polyline path from `start` to `end`
 * around circles, rectangles, revision clouds, and weld stamps on the active page.
 */
export function routeAroundObstacles(
  start: Point2D,
  end: Point2D,
  entities: ICadEntity[],
  pageNumber: number,
  padding = 8,
): Point2D[] {
  const distDirect = Math.hypot(end.x - start.x, end.y - start.y);
  if (distDirect < 1e-3) return [start, end];

  const allObstacles = extractObstacles(entities, pageNumber);
  if (allObstacles.length === 0) return [start, end];

  // Ignore obstacles that strictly contain start or end so we can still route out/in
  const obstacles = allObstacles.filter(
    (o) => !pointStrictlyInsideObstacle(start, o) && !pointStrictlyInsideObstacle(end, o),
  );
  if (obstacles.length === 0) return [start, end];

  const hasDirectHit = obstacles.some((o) => segmentIntersectsObstacleInterior(start, end, o));
  if (!hasDirectHit) return [start, end];

  const nodes: Point2D[] = [start, end];
  for (const obs of obstacles) {
    nodes.push(...obstaclePerimeterNodes(obs, padding));
  }

  const n = nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  dist[0] = 0;

  const isVisible = (i: number, j: number): boolean => {
    const a = nodes[i];
    const b = nodes[j];
    for (let k = 0; k < obstacles.length; k++) {
      if (segmentIntersectsObstacleInterior(a, b, obstacles[k])) return false;
    }
    return true;
  };

  for (let step = 0; step < n; step++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1 || u === 1) break;
    visited[u] = 1;

    for (let v = 0; v < n; v++) {
      if (visited[v] || v === u) continue;
      const w = Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
      const alt = dist[u] + w;
      if (alt >= dist[v]) continue;
      if (isVisible(u, v)) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if (prev[1] === -1) return [start, end];

  const path: Point2D[] = [];
  let cur = 1;
  while (cur !== -1) {
    path.push(nodes[cur]);
    cur = prev[cur];
  }
  path.reverse();
  return path;
}
