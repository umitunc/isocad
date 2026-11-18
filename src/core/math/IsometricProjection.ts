import { Point2D } from '../interfaces/ICadEntity';

export type IsoplaneMode = 'OFF' | 'LEFT' | 'TOP' | 'RIGHT';

const ISOPLANE_ANGLES_DEG: Record<Exclude<IsoplaneMode, 'OFF'>, number[]> = {
  TOP: [30, 150, 210, 330],
  LEFT: [90, 150, 270, 330],
  RIGHT: [30, 90, 210, 270],
};

export function cycleIsoplane(current: IsoplaneMode): IsoplaneMode {
  const order: IsoplaneMode[] = ['OFF', 'TOP', 'RIGHT', 'LEFT'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function constrainOrtho(anchor: Point2D, cursor: Point2D): Point2D {
  const dx = cursor.x - anchor.x;
  const dy = cursor.y - anchor.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: cursor.x, y: anchor.y };
  }
  return { x: anchor.x, y: cursor.y };
}

export function constrainIsoplane(
  anchor: Point2D,
  cursor: Point2D,
  mode: Exclude<IsoplaneMode, 'OFF'>,
): Point2D {
  const dx = cursor.x - anchor.x;
  const dy = cursor.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { ...cursor };

  const angles = ISOPLANE_ANGLES_DEG[mode];
  let bestProj = { x: cursor.x, y: cursor.y };
  let bestDot = -Infinity;

  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const dot = dx * ux + dy * uy;
    if (dot > bestDot) {
      bestDot = dot;
      bestProj = {
        x: anchor.x + ux * dot,
        y: anchor.y + uy * dot,
      };
    }
  }
  return bestProj;
}

export function parsePolarOrRelativeInput(
  raw: string,
  anchor?: Point2D,
): Point2D | null {
  const trimmed = raw.trim();
  // Polar: @150<30
  const polarMatch = trimmed.match(/^@(-?\d+(?:\.\d+)?)<(-?\d+(?:\.\d+)?)$/);
  if (polarMatch && anchor) {
    const dist = Number.parseFloat(polarMatch[1]);
    const deg = Number.parseFloat(polarMatch[2]);
    const rad = (deg * Math.PI) / 180;
    return {
      x: anchor.x + Math.cos(rad) * dist,
      y: anchor.y - Math.sin(rad) * dist, // Screen/PDF Y-down convention
    };
  }

  // Relative cartesian: @100,-50
  const relMatch = trimmed.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (relMatch && anchor) {
    return {
      x: anchor.x + Number.parseFloat(relMatch[1]),
      y: anchor.y + Number.parseFloat(relMatch[2]),
    };
  }

  // Absolute cartesian: 412.5,288.0
  const absMatch = trimmed.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (absMatch) {
    return {
      x: Number.parseFloat(absMatch[1]),
      y: Number.parseFloat(absMatch[2]),
    };
  }

  return null;
}
