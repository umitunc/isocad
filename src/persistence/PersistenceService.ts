import { openDB } from 'idb';
import { EndpointConfig } from '../core/interfaces/IDataSyncAdapter';
import { IsoplaneMode } from '../core/math/IsometricProjection';
import { ViewportTransform } from '../core/interfaces/IRenderEngine';
import { LocaleCode } from '../i18n/types';
import { PipingExtractionResult } from '../piping-domain/types/PipingModels';
import { EditMode, VersionSnapshot } from '../store/useEditorStore';

const STORAGE_KEY = 'qcad_full_workspace_v1';
const DB_NAME = 'qcad_pdf_vault_v1';
const STORE_NAME = 'pdfs';

export interface PersistedWorkspaceState {
  version: 1;
  savedAt: number;
  locale: LocaleCode;
  drawingType: 'engineering' | 'spool' | 'as_build';
  drawingNo: string;
  revisionNo: string;
  activePdfUrl: string;
  isLocalUpload: boolean;
  currentPage: number;
  viewport: ViewportTransform;
  editMode: EditMode;
  strokeColor: string;
  orthoEnabled: boolean;
  isoplaneMode: IsoplaneMode;
  gridVisible: boolean;
  showRulers: boolean;
  selectedSpool: string;
  selectedJoint: string;
  selectedWelder: string;
  drawerOpen: boolean;
  drawerTab: 'mto' | 'weld' | 'cut' | 'support';
  endpointConfig: EndpointConfig;
  selectedAdapterId: string;
  pipingData: PipingExtractionResult | null;
  cadEntities: Array<Record<string, unknown>>;
  versions: VersionSnapshot[];
}

export function saveWorkspaceToLocalStorage(state: PersistedWorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fallback: if pipingData is huge, keep entities & settings
    try {
      const compact = { ...state, pipingData: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // ignore quota exceeded
    }
  }
}

export function loadWorkspaceFromLocalStorage(): PersistedWorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkspaceState;
    if (parsed && parsed.version === 1) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearWorkspaceLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function getPdfDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveUploadedPdfBytes(bytes: Uint8Array, fileName: string): Promise<void> {
  try {
    const db = await getPdfDb();
    await db.put(STORE_NAME, { bytes, fileName, savedAt: Date.now() }, 'active_uploaded_pdf');
  } catch {
    // ignore idb errors
  }
}

export async function loadUploadedPdfBytes(): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  try {
    const db = await getPdfDb();
    const rec = (await db.get(STORE_NAME, 'active_uploaded_pdf')) as
      | { bytes: Uint8Array; fileName: string }
      | undefined;
    return rec ?? null;
  } catch {
    return null;
  }
}
