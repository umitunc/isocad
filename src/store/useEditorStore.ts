import { create } from 'zustand';
import { EndpointConfig, QCadExportEnvelope, SyncResult } from '../core/interfaces/IDataSyncAdapter';
import { IsoplaneMode } from '../core/math/IsometricProjection';
import { PipingExtractionResult } from '../piping-domain/types/PipingModels';

export type EditMode = 'cad' | 'joints' | 'joints_welder';

export interface SampleManifestItem {
  id: string;
  drawingNo: string;
  drawingType: 'engineering' | 'spool' | 'as_build';
  revision: string;
  isLatest: boolean;
  title: string;
  url: string;
}

export interface VersionSnapshot {
  version: number;
  timestamp: string;
  user: string;
  action: string;
  entitiesCount: number;
  serializedEntities: Array<Record<string, unknown>>;
}

interface EditorState {
  drawingType: 'engineering' | 'spool' | 'as_build';
  drawingNo: string;
  revisionNo: string;
  activePdfUrl: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  activeTool: string;
  editMode: EditMode;
  strokeColor: string;
  orthoEnabled: boolean;
  isoplaneMode: IsoplaneMode;
  gridVisible: boolean;
  showRulers: boolean;
  hasUnsavedChanges: boolean;

  selectedSpool: string;
  selectedJoint: string;
  selectedWelder: string;
  welders: string[];
  spools: string[];
  joints: string[];

  pipingData: PipingExtractionResult | null;
  drawerOpen: boolean;
  drawerTab: 'mto' | 'weld' | 'cut' | 'support';

  activeJointModalEntityId: string | null;
  endpointModalOpen: boolean;
  scaleModalOpen: boolean;
  sidebarOpen: boolean;

  versions: VersionSnapshot[];
  activeVersion: number | null;

  endpointConfig: EndpointConfig;
  selectedAdapterId: string;
  lastEnvelope: QCadExportEnvelope | null;
  syncLogs: SyncResult[];

  setField: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
  addVersionSnapshot: (action: string, serialized: Array<Record<string, unknown>>) => void;
  addSyncLog: (res: SyncResult, env: QCadExportEnvelope) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  drawingType: 'engineering',
  drawingNo: 'GN-80-AH01FS-FA00.030',
  revisionNo: '01',
  activePdfUrl: '/samples/GN-80-AH01FS-FA00.030.pdf',
  currentPage: 1,
  totalPages: 1,
  zoom: 1,
  activeTool: 'select',
  editMode: 'joints_welder',
  strokeColor: '#ef4444',
  orthoEnabled: false,
  isoplaneMode: 'OFF',
  gridVisible: true,
  showRulers: true,
  hasUnsavedChanges: false,

  selectedSpool: 'SP-001',
  selectedJoint: '53A',
  selectedWelder: 'W-104',
  welders: ['W-104', 'W-108', 'W-211', 'W-305'],
  spools: ['SP-001', 'SP-002', 'SP-003'],
  joints: [],

  pipingData: null,
  drawerOpen: false,
  drawerTab: 'mto',

  activeJointModalEntityId: null,
  endpointModalOpen: false,
  scaleModalOpen: false,
  sidebarOpen: true,

  versions: [],
  activeVersion: null,

  endpointConfig: {
    url: 'https://sandbox.qcad.dev/api/v1/weldmap/sync',
    method: 'POST',
    authType: 'bearer',
    token: 'qcad_demo_token_2026',
    headerName: 'X-API-Key',
    includeVectorPdf: true,
  },
  selectedAdapterId: 'demo-simulator',
  lastEnvelope: null,
  syncLogs: [],

  setField: (key, value) => set({ [key]: value } as Partial<EditorState>),
  addVersionSnapshot: (action, serialized) =>
    set((s) => {
      const nextVer = s.versions.length + 1;
      const snap: VersionSnapshot = {
        version: nextVer,
        timestamp: new Date().toLocaleTimeString(),
        user: 'Lead Piping Eng.',
        action,
        entitiesCount: serialized.length,
        serializedEntities: serialized,
      };
      return {
        versions: [snap, ...s.versions],
        activeVersion: nextVer,
        hasUnsavedChanges: false,
      };
    }),
  addSyncLog: (res, env) =>
    set((s) => ({
      syncLogs: [res, ...s.syncLogs].slice(0, 20),
      lastEnvelope: env,
    })),
}));
