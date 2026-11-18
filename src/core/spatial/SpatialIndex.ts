import RBush from 'rbush';
import { BoundingBox, ICadEntity, Point2D } from '../interfaces/ICadEntity';

export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  entity: ICadEntity;
}

export class SpatialIndex {
  private tree = new RBush<SpatialItem>();
  private itemMap = new Map<string, SpatialItem>();

  public insert(entity: ICadEntity): void {
    this.remove(entity.id);
    const box = entity.getBoundingBox();
    const item: SpatialItem = {
      minX: box.minX,
      minY: box.minY,
      maxX: box.maxX,
      maxY: box.maxY,
      entity,
    };
    this.itemMap.set(entity.id, item);
    this.tree.insert(item);
  }

  public remove(entityId: string): void {
    const existing = this.itemMap.get(entityId);
    if (existing) {
      this.tree.remove(existing, (a, b) => a.entity.id === b.entity.id);
      this.itemMap.delete(entityId);
    }
  }

  public update(entity: ICadEntity): void {
    this.insert(entity);
  }

  public clear(): void {
    this.tree.clear();
    this.itemMap.clear();
  }

  public searchBox(box: BoundingBox): ICadEntity[] {
    return this.tree.search(box).map((item) => item.entity);
  }

  public searchPoint(point: Point2D, toleranceWorld: number): ICadEntity[] {
    const box: BoundingBox = {
      minX: point.x - toleranceWorld,
      minY: point.y - toleranceWorld,
      maxX: point.x + toleranceWorld,
      maxY: point.y + toleranceWorld,
    };
    return this.searchBox(box);
  }

  public rebuild(entities: ICadEntity[]): void {
    this.clear();
    const items: SpatialItem[] = entities.map((entity) => {
      const box = entity.getBoundingBox();
      const item: SpatialItem = { ...box, entity };
      this.itemMap.set(entity.id, item);
      return item;
    });
    this.tree.load(items);
  }
}
