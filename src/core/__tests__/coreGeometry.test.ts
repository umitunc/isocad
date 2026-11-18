import { describe, it, expect } from 'vitest';
import { computeLeaderEdgeAnchor } from '../math/LeaderEdgeAnchor';
import { constrainIsoplane, parsePolarOrRelativeInput } from '../math/IsometricProjection';
import { CommandManager } from '../commands/CommandManager';
import { AddEntityCommand, EntityRepository } from '../commands/EntityCommands';
import { LineEntity } from '../entities/LineEntity';
import { ICadEntity } from '../interfaces/ICadEntity';
import { WeldStampEntity } from '../entities/WeldStampEntity';

describe('QCad Core Geometry & Commands', () => {
  it('computes circle leader edge anchor on circumference', () => {
    const edge = computeLeaderEdgeAnchor('circle', { x: 100, y: 100 }, 40, 40, { x: 200, y: 100 });
    expect(edge.x).toBeCloseTo(120, 4);
    expect(edge.y).toBeCloseTo(100, 4);
  });

  it('keeps weld stamp leader anchor pinned while stamp translates', () => {
    const stamp = new WeldStampEntity({
      id: 'J-1',
      shapeKind: 'triangle',
      center: { x: 150, y: 150 },
      width: 48,
      height: 48,
      leaderAnchor: { x: 100, y: 200 },
      jointNo: '53A',
      welderId: 'W-104',
    });
    stamp.translate(30, -20);
    expect(stamp.center).toEqual({ x: 180, y: 130 });
    expect(stamp.leaderAnchor).toEqual({ x: 100, y: 200 });
    expect(stamp.getPrimaryLabel()).toBe('F53A');
    expect(stamp.getSecondaryLabel()).toBe('W-104');
  });

  it('constrains isometric movement to 30/150 degree axes in TOP isoplane', () => {
    const pt = constrainIsoplane({ x: 0, y: 0 }, { x: 100, y: 55 }, 'TOP');
    const angleDeg = (Math.atan2(pt.y, pt.x) * 180) / Math.PI;
    expect(Math.round(angleDeg)).toBe(30);
  });

  it('parses polar CAD CLI input @100<30', () => {
    const pt = parsePolarOrRelativeInput('@100<30', { x: 10, y: 100 });
    expect(pt).not.toBeNull();
    expect(pt!.x).toBeCloseTo(10 + 100 * Math.cos(Math.PI / 6), 3);
    expect(pt!.y).toBeCloseTo(100 - 100 * Math.sin(Math.PI / 6), 3);
  });

  it('executes and undoes commands cleanly via CommandManager', () => {
    const map = new Map<string, ICadEntity>();
    const repo: EntityRepository = {
      add: (e) => map.set(e.id, e),
      remove: (id) => map.delete(id),
      getById: (id) => map.get(id),
      replace: (e) => map.set(e.id, e),
    };
    const mgr = new CommandManager();
    const line = new LineEntity('L1', { x: 0, y: 0 }, { x: 50, y: 50 });

    mgr.execute(new AddEntityCommand(repo, line));
    expect(map.size).toBe(1);
    expect(mgr.canUndo()).toBe(true);

    mgr.undo();
    expect(map.size).toBe(0);
    expect(mgr.canRedo()).toBe(true);

    mgr.redo();
    expect(map.size).toBe(1);
  });
});
