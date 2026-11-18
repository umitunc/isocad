# QCad — Gemini Hydrogen Uygulama Kılavuzu ve Teknik Sözleşmeler (Execution Blueprint)

> **YÜRÜTÜCÜ AJAN (GEMINI HYDROGEN) İÇİN KESİN TALİMATLAR:**
> 1. Bu proje **SOLID prensiplerine** sıkı sıkıya bağlıdır. `src/core/` ve `src/piping-domain/` altında **ASLA** `react`, `react-dom` veya doğrudan DOM/UI bağımlılığı kullanma.
> 2. Hiçbir kaynak dosyası **300 satırı** aşmamalıdır. Büyüyen sınıfları alt strateji veya yardımcı modüllere böl.
> 3. Her faz tamamlandığında `npx tsc --noEmit` çalıştırmadan bir sonraki faza **GEÇME**.
> 4. Eski Stellar sistemindeki (`pdf-editor.blade.php`) gibi tüm PDF'i PNG bitmap'e çevirip kaydetme hatasını **YAPMA**: Görselleştirme `WebGL2 + PDF.js`, çıktı ise `pdf-lib` ile **gerçek vektör PDF** olmalıdır.
> 5. **Çoklu Dil (Localization - `TR | EN | RU`):** Tüm UI (Landing Page, Editör, Modallar, Dokümantasyon) Türkçe (`tr`), İngilizce (`en`) ve Rusça (`ru` — Kiril) dillerini tam desteklemelidir (`src/i18n/` altında `IStrategy`/sözlük yapısı; `tr.ts`, `en.ts`, `ru.ts` + `useLocaleStore`). Endüstriyel standart kısaltmalar (`MTO`, `DAN Code`, `NPS`, `DN`, `BE/BE`, `OSNAP`) evrensel olarak korunur.
> 6. **Görsel Referans Mockupları:** `docs/mockups/` klasöründeki 4 UI mockup'ı (`01-landing-page.jpg`, `02-webgl-cad-pdf-editor.jpg`, `03-joint-modal-and-mto-drawer.jpg`, `04-docs-and-api-bridge.jpg`) görsel tasarım ve yerleşim referansı olarak kullanılmalıdır.

---

## 1. Çekirdek SOLID TypeScript Sözleşmeleri (`src/core/interfaces/`)

Faz 1'de bu arayüzler birebir oluşturulmalı ve tüm modüller bu sözleşmelere uymalıdır:

```typescript
// src/core/interfaces/ICadEntity.ts
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type EntityType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'rect'
  | 'triangle'
  | 'hexagon'
  | 'text'
  | 'dimension'
  | 'revcloud'
  | 'weld_stamp';

export interface RenderLinePrimitive {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorRgba: [number, number, number, number];
  width: number;
  screenSpaceWidth?: boolean;
  dashPattern?: [number, number];
}

export interface ICadEntity {
  readonly id: string;
  readonly type: EntityType;
  layerId: string;
  pageNumber: number;
  strokeColor: string;
  strokeWidth: number;
  locked: boolean;
  visible: boolean;

  getBoundingBox(): BoundingBox;
  hitTest(worldPoint: Point2D, toleranceWorld: number): boolean;
  getSnapPoints(): Array<{ point: Point2D; kind: 'END' | 'MID' | 'CEN' | 'QUAD' }>;
  translate(dx: number, dy: number): void;
  scale(origin: Point2D, sx: number, sy: number): void;
  rotate(origin: Point2D, angleRad: number): void;
  toRenderPrimitives(isSelected: boolean, isHovered: boolean): RenderLinePrimitive[];
  clone(): ICadEntity;
  serialize(): Record<string, unknown>;
}
```

```typescript
// src/core/interfaces/ICommand.ts
export interface ICommand {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  execute(): void;
  undo(): void;
}
```

```typescript
// src/core/interfaces/ICadTool.ts
import { Point2D } from './ICadEntity';
import { RenderLinePrimitive } from './ICadEntity';

export interface ToolPointerEvent {
  world: Point2D;
  snapped: Point2D;
  screen: Point2D;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  button: number;
}

export interface ICadTool {
  readonly name: string;
  readonly shortcut: string;
  readonly cursor: string;
  onActivate(): void;
  onDeactivate(): void;
  onPointerDown(evt: ToolPointerEvent): void;
  onPointerMove(evt: ToolPointerEvent): void;
  onPointerUp(evt: ToolPointerEvent): void;
  onDoubleClick?(evt: ToolPointerEvent): void;
  onKeyDown?(key: string, evt: KeyboardEvent): void;
  onCommandInput?(rawInput: string): boolean;
  getPreviewPrimitives(): RenderLinePrimitive[];
}
```

```typescript
// src/core/interfaces/IDataSyncAdapter.ts
export interface QCadExportEnvelope {
  schemaVersion: '1.0.0';
  exportedAt: string;
  stage: 'draft' | 'pdf_spool_iso' | 'pdf_as_build';
  document: {
    drawingType: 'engineering' | 'spool' | 'as_build';
    drawingNo: string;
    lineNo: string;
    revisionNo: string;
    sheetNo: string;
    totalPages: number;
    continuation?: { type: 'ON' | 'FROM'; target: string } | null;
  };
  pipingData: {
    mto: unknown[];
    weldLog: unknown[];
    cutList: unknown[];
    supportList: unknown[];
  };
  annotations: unknown[];
  cadEntities: Array<Record<string, unknown>>;
  artifacts?: {
    vectorPdfBlob?: Blob;
    excelBlob?: Blob;
    dxfText?: string;
  };
}

export interface SyncResult {
  success: boolean;
  statusCode: number;
  endpointUrl: string;
  message: string;
  remotePayload?: unknown;
  durationMs: number;
}

export interface IDataSyncAdapter {
  readonly adapterId: string;
  readonly displayName: string;
  pushDocumentState(envelope: QCadExportEnvelope): Promise<SyncResult>;
  pullDocumentData?(drawingNo: string, pageNumber?: number): Promise<Partial<QCadExportEnvelope>>;
}
```

---

## 2. Sabit Domain Tabloları (`docs/idea/piping_extractor_v9.py` & Stellar Eşlenikleri)

Gemini Hydrogen Faz 5 ve Faz 6'yı kodlarken bu sabitleri **değiştirmeden** kullanmalıdır:

### 2.1. MTO Sütun Oranları ve DN -> NPS Inch Tablosu (`src/piping-domain/parsers/constants.ts`)
- **Danieli Sütun Oranları (`x0 / pageWidth`):**
  - `item`: `[0.715, 0.733]`
  - `desc`: `[0.733, 0.852]`
  - `size`: `[0.852, 0.883]`
  - `dan`: `[0.883, 0.921]`
  - `qty`: `[0.921, 0.952]`
  - `weight`: `[0.952, 1.001]`
- **Linde / Energiron Sütun Oranları (`pageWidth < 1500`):**
  - `item`: `[0.780, 0.830]`, `desc`: `[0.830, 0.900]`, `size`: `[0.900, 0.930]`, `dan`: `[0.930, 0.960]`, `qty`: `[0.960, 0.985]`, `weight`: `[0.985, 1.001]`
- **EN + RU Bölüm Başlıkları:**
  - `PIPE` / `ТРУБА` -> `PIPE` (Birim: `M`)
  - `FITTINGS` / `ФИТИНГИ` -> `FITTINGS` (Birim: `ADT`)
  - `FLANGES` / `ФЛАНЦЫ` / `ФЛАНЕЦ` -> `FLANGES`
  - `GASKETS` / `ПРОКЛАДКИ` / `ПРОКЛАДКА` -> `GASKETS`
  - `VALVES` / `VALVES/IN-LINEITEMS` / `КЛАПАНЫ` -> `VALVES`
  - `SUPPORTS` / `ОПОРЫ` -> `SUPPORTS`
  - `INSTRUMENTS` / `ПРИБОРЫ` -> `INSTRUMENTS`
  - `BOLTS` -> `BOLTS`
- **DAN Kodu Normalizasyonu:**
  - İki satıra bölünmüş `['000-000-089-', '462']` -> `'000-000-089-462'` (12 rakam `XXX-XXX-XXX-XXX` formatına tamamlanır).
- **Cut List Bend Kuralı:**
  - `<N> length size [PLD BEND | 3D BEND | 4D BEND] [BE/BE | BE/PE | PE/PE | TH/BE]`
  - `3D/4D/PLD BEND` boru bükümüdür; kaynak (`WeldJoint`) sayısını artırmaz!

### 2.2. Stellar `JointWidgetModal` ve `WeldStampEntity` Kuralları
- **Damga Tipleri:**
  - `Field Weld (F)` -> **Üçgen (`triangle`)** -> Otomatik `type_of_joint = 'F'`
  - `Shop Weld (S)` -> **Daire (`circle`)** -> Otomatik `type_of_joint = 'S'`
  - `Spool` -> **Dikdörtgen (`rect`)**
- **Draw Joint No Kuralı:** `draw_joint_no = type_of_joint + joint_no` (Örn: `F` + `53A` = `F53A`).
- **Joint Modal Alanları:**
  - `type_of_joint` (`F`/`S`), `type_of_welds` (`BW`, `SW`, `FW`, `SOB`, `TW`), `joint_no`, `draw_joint_no`, `welding_date`
  - `spool_no1`, `spool_no2`, `pose_no1`, `pose_no2`
  - `member1`, `member2` (PDF MTO listesinden veya dış API IC-Log'dan seçildiğinde otomatik doldurulur: `material`, `dia1`, `dia2`, `nps1`, `nps2`, `thickness1`, `thickness2`, `danCode1`, `danCode2`)
  - `welder_id` (`Adding Joints & Welder` modunda seçilir; doluysa damga şeklinin ortasına yatay `divider` çizilir, üste `joint_no`, alta `welder_id` yazılır).

---

## 3. Faz Bazlı Gemini Hydrogen Çalıştırma Komutları (Prompt Şablonları)

Kullanıcı her aşamada Gemini Hydrogen'e aşağıdaki kısa direktifleri sırayla verebilir:

- **Adım 1 Promptu:** `"docs/GEMINI_HYDROGEN_BLUEPRINT.md ve implementation_plan.md Faz 1 kapsamını uygula: Vite + React + TS + Tailwind kurulumunu yap, örnek PDF'leri public/samples/ altına kopyala ve tüm SOLID core interface dosyalarını oluşturup tsc --noEmit ile doğrula."`
- **Adım 2 Promptu:** `"Faz 2 kapsamını uygula: src/core/math, spatial (rbush + OSNAP + Isoplane), layers, commands (Undo/Redo) ve entities (WeldStampEntity dahil) modüllerini yaz ve Vitest birim testleriyle doğrula."`
- **Adım 3 Promptu:** `"Faz 3 kapsamını uygula: src/engine-webgl/ altında WebGL2Renderer, Instanced Line/Symbol Shader'ları, PdfTileManager (PDF vektörlerini SpatialIndex'e yükleyen yapı dahil) ve Retina TextAndHudOverlay cetvel/etiket katmanını kodla."`
- **Adım 4 Promptu:** `"Faz 4 kapsamını uygula: AutoCAD çizim araçlarını (Select/Window-Crossing, Line, Polyline, Circle/Arc/Rect/Triangle, Trim, Offset, Dimension/ScaleCalibration, RevCloud, LeaderStampTool) ve alt CommandLineInterpreter'ı kodla."`
- **Adım 5 Promptu:** `"Faz 5 kapsamını uygula: docs/idea/piping_extractor_v9.py içindeki Danieli/Linde/StateMachine MTO, CutList, Support, Continuation ve VectorTopology WeldLog çıkarım motorunu src/piping-domain/ altına SOLID stratejileriyle port et."`
- **Adım 6 Promptu:** `"Faz 6 kapsamını uygula: Editör kabuğunu (/editor), RightInspectorSidebar, JointWidgetModal (MTO otomatik malzeme/çap/kalınlık doldurma dahil), BottomDataDrawer (tablo-kamera senkronlu) ve IndexedDB/Versiyon geçmişini oluştur."`
- **Adım 7 Promptu:** `"Faz 7 kapsamını uygula: pdf-lib ile gerçek vektör PDF çıktısı (PdfVectorExporter), exceljs ile 5 sayfalı stilli Excel çıktısı (OZET, MTO, Weld_Log, Cut_List, Support_List), DXF çıktısı ve dış sistem aktarım adaptörlerini (RestWebhookAdapter, StellarApiAdapter, PostMessageBridge + EndpointConfigModal) tamamla."`
- **Adım 8 Promptu:** `"Faz 8 kapsamını uygula: Precision Industrial Dark tasarım diliyle Landing Page (/) ve Hero içinde çalışan interaktif mini-WebGL izometrik önizleme sahnesini oluştur."`
- **Adım 9 Promptu:** `"Faz 9 kapsamını uygula: /demo rotasındaki örnek PDF hızlı yükleyici + Canlı API/Webhook Payload Gözlemcisini ve /docs/* altındaki 6 bölümlük dokümantasyon portalını tamamla."`
- **Adım 10 Promptu:** `"Faz 10 kapsamını uygula: Vite code-splitting optimizasyonunu yap, SOLID katman izolasyonunu denetle, tüm testleri ve production build'i çalıştırıp sıfır hatayla teslim et."`
