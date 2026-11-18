import { Point2D, SnapKind, SnapPoint } from './ICadEntity';

export interface SnapSearchOptions {
  toleranceWorld: number;
  enabledKinds: Set<SnapKind>;
  orthoEnabled: boolean;
  isoplaneMode: 'OFF' | 'LEFT' | 'TOP' | 'RIGHT';
  referencePoint?: Point2D;
}

export interface ISnapProvider {
  findBestSnap(worldCursor: Point2D, options: SnapSearchOptions): SnapPoint | null;
  applyAxisConstraint(anchor: Point2D, cursor: Point2D, options: SnapSearchOptions): Point2D;
}
