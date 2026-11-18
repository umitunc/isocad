import { Point2D } from '../interfaces/ICadEntity';

export function vecAdd(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v: Point2D, s: number): Point2D {
  return { x: v.x * s, y: v.y * s };
}

export function vecDot(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y;
}

export function vecLenSq(v: Point2D): number {
  return v.x * v.x + v.y * v.y;
}

export function vecLen(v: Point2D): number {
  return Math.hypot(v.x, v.y);
}

export function vecDist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function vecNormalize(v: Point2D): Point2D {
  const len = vecLen(v);
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
}

export function vecMid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

export function rotatePoint(pt: Point2D, origin: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export function scalePoint(pt: Point2D, origin: Point2D, sx: number, sy: number): Point2D {
  return {
    x: origin.x + (pt.x - origin.x) * sx,
    y: origin.y + (pt.y - origin.y) * sy,
  };
}
