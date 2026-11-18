import { ICadEntity, Point2D } from '../interfaces/ICadEntity';
import { ICommand } from '../interfaces/ICommand';
import { WeldStampEntity } from '../entities/WeldStampEntity';

export interface EntityRepository {
  add(entity: ICadEntity): void;
  remove(entityId: string): void;
  getById(entityId: string): ICadEntity | undefined;
  replace(entity: ICadEntity): void;
}

export class AddEntityCommand implements ICommand {
  public readonly id: string;
  public readonly timestamp = Date.now();

  constructor(
    private readonly repo: EntityRepository,
    private readonly entity: ICadEntity,
    public readonly label = `Add ${entity.type}`,
  ) {
    this.id = `cmd-add-${entity.id}-${this.timestamp}`;
  }

  public execute(): void {
    this.repo.add(this.entity);
  }

  public undo(): void {
    this.repo.remove(this.entity.id);
  }
}

export class RemoveEntityCommand implements ICommand {
  public readonly id: string;
  public readonly timestamp = Date.now();

  constructor(
    private readonly repo: EntityRepository,
    private readonly entity: ICadEntity,
    public readonly label = `Delete ${entity.type}`,
  ) {
    this.id = `cmd-del-${entity.id}-${this.timestamp}`;
  }

  public execute(): void {
    this.repo.remove(this.entity.id);
  }

  public undo(): void {
    this.repo.add(this.entity);
  }
}

export class TranslateEntityCommand implements ICommand {
  public readonly id: string;
  public readonly timestamp = Date.now();

  constructor(
    private readonly repo: EntityRepository,
    private readonly entityId: string,
    private readonly dx: number,
    private readonly dy: number,
    public readonly label = 'Move Entity',
  ) {
    this.id = `cmd-move-${entityId}-${this.timestamp}`;
  }

  public execute(): void {
    const ent = this.repo.getById(this.entityId);
    if (ent) {
      ent.translate(this.dx, this.dy);
      this.repo.replace(ent);
    }
  }

  public undo(): void {
    const ent = this.repo.getById(this.entityId);
    if (ent) {
      ent.translate(-this.dx, -this.dy);
      this.repo.replace(ent);
    }
  }
}

export class BatchCommand implements ICommand {
  public readonly id: string;
  public readonly timestamp = Date.now();

  constructor(
    private readonly commands: ICommand[],
    public readonly label: string,
  ) {
    this.id = `cmd-batch-${this.timestamp}`;
  }

  public execute(): void {
    for (const c of this.commands) c.execute();
  }

  public undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

export class MoveLeaderAnchorCommand implements ICommand {
  public readonly id: string;
  public readonly timestamp = Date.now();
  private readonly oldAnchor: Point2D;
  private readonly newAnchor: Point2D;

  constructor(
    private readonly repo: EntityRepository,
    private readonly entityId: string,
    oldAnchor: Point2D,
    newAnchor: Point2D,
    public readonly label = 'Move Leader Anchor',
  ) {
    this.id = `cmd-anchor-${entityId}-${this.timestamp}`;
    this.oldAnchor = { ...oldAnchor };
    this.newAnchor = { ...newAnchor };
  }

  public execute(): void {
    const ent = this.repo.getById(this.entityId);
    if (ent instanceof WeldStampEntity) {
      ent.leaderAnchor = { ...this.newAnchor };
      this.repo.replace(ent);
    }
  }

  public undo(): void {
    const ent = this.repo.getById(this.entityId);
    if (ent instanceof WeldStampEntity) {
      ent.leaderAnchor = { ...this.oldAnchor };
      this.repo.replace(ent);
    }
  }
}
