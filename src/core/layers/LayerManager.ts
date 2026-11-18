export type LineStyle = 'solid' | 'dashed' | 'center';

export interface CadLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  lineStyle: LineStyle;
  isSystem?: boolean;
}

const DEFAULT_LAYERS: CadLayer[] = [
  { id: '0', name: '0 (Default)', color: '#00e5ff', visible: true, locked: false, lineStyle: 'solid', isSystem: true },
  { id: 'PDF-Underlay', name: 'PDF Underlay', color: '#94a3b8', visible: true, locked: true, lineStyle: 'solid', isSystem: true },
  { id: 'Piping-Centerline', name: 'Piping Centerline', color: '#38bdf8', visible: true, locked: false, lineStyle: 'center' },
  { id: 'Dimensions', name: 'Dimensions', color: '#facc15', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'Welds-Field', name: 'Welds — Field (F)', color: '#ef4444', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'Welds-Shop', name: 'Welds — Shop (S)', color: '#f59e0b', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'Spools', name: 'Spools', color: '#22c55e', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'Supports', name: 'Supports', color: '#a855f7', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'Redline', name: 'Redline / RevCloud', color: '#f43f5e', visible: true, locked: false, lineStyle: 'dashed' },
];

export class LayerManager {
  private layers = new Map<string, CadLayer>();
  private activeLayerId = '0';

  constructor() {
    for (const layer of DEFAULT_LAYERS) {
      this.layers.set(layer.id, { ...layer });
    }
  }

  public getAll(): CadLayer[] {
    return Array.from(this.layers.values());
  }

  public get(id: string): CadLayer | undefined {
    return this.layers.get(id);
  }

  public getActiveLayerId(): string {
    return this.activeLayerId;
  }

  public setActiveLayer(id: string): void {
    if (this.layers.has(id)) {
      this.activeLayerId = id;
    }
  }

  public addLayer(layer: CadLayer): void {
    this.layers.set(layer.id, { ...layer });
  }

  public toggleVisibility(id: string): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    layer.visible = !layer.visible;
    return layer.visible;
  }

  public toggleLock(id: string): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    layer.locked = !layer.locked;
    return layer.locked;
  }
}
