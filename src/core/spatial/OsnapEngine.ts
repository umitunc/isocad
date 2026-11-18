import { Point2D, SnapKind, SnapPoint } from '../interfaces/ICadEntity';
import { ISnapProvider, SnapSearchOptions } from '../interfaces/ISnapProvider';
import { constrainIsoplane, constrainOrtho } from '../math/IsometricProjection';
import { SpatialIndex } from './SpatialIndex';

const SNAP_PRIORITY: Record<SnapKind, number> = {
  END: 1,
  INT: 2,
  CEN: 3,
  MID: 4,
  QUAD: 5,
  PER: 6,
  ISO: 7,
  NEA: 8,
};

export interface VectorSegment2D {
  p1: Point2D;
  p2: Point2D;
}

export class OsnapEngine implements ISnapProvider {
  private pdfSnapPoints: SnapPoint[] = [];
  private pdfVectorSegments: VectorSegment2D[] = [];

  constructor(private readonly spatialIndex: SpatialIndex) {}

  public setPdfVectorSnaps(points: SnapPoint[]): void {
    this.pdfSnapPoints = points;
  }

  public getPdfVectorSnaps(): readonly SnapPoint[] {
    return this.pdfSnapPoints;
  }

  public setPdfVectorSegments(segments: VectorSegment2D[]): void {
    this.pdfVectorSegments = segments;
  }

  public getPdfVectorSegments(): readonly VectorSegment2D[] {
    return this.pdfVectorSegments;
  }

  public findBestSnap(worldCursor: Point2D, options: SnapSearchOptions): SnapPoint | null {
    const tol = options.toleranceWorld;
    const candidates: SnapPoint[] = [];

    const nearby = this.spatialIndex.searchPoint(worldCursor, tol);
    for (const entity of nearby) {
      if (!entity.visible) continue;
      for (const sp of entity.getSnapPoints()) {
        if (options.enabledKinds.has(sp.kind)) {
          candidates.push(sp);
        }
      }
    }

    // Also check extracted PDF vector endpoints/midpoints
    for (const sp of this.pdfSnapPoints) {
      if (!options.enabledKinds.has(sp.kind)) continue;
      if (
        Math.abs(sp.point.x - worldCursor.x) <= tol &&
        Math.abs(sp.point.y - worldCursor.y) <= tol
      ) {
        candidates.push(sp);
      }
    }

    let best: SnapPoint | null = null;
    let bestScore = Infinity;

    for (const c of candidates) {
      const dist = Math.hypot(c.point.x - worldCursor.x, c.point.y - worldCursor.y);
      if (dist > tol) continue;
      const score = dist + SNAP_PRIORITY[c.kind] * (tol * 0.05);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return best;
  }

  public applyAxisConstraint(
    anchor: Point2D,
    cursor: Point2D,
    options: SnapSearchOptions,
  ): Point2D {
    if (options.isoplaneMode !== 'OFF') {
      return constrainIsoplane(anchor, cursor, options.isoplaneMode);
    }
    if (options.orthoEnabled) {
      return constrainOrtho(anchor, cursor);
    }
    return cursor;
  }
}
