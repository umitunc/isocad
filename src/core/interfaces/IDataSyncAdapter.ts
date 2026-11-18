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
    continuation?: { type: 'ON' | 'FROM' | 'TO'; target: string } | null;
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
    vectorPdfBase64?: string;
    excelFileName?: string;
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

export interface EndpointConfig {
  url: string;
  method: 'POST' | 'PUT';
  authType: 'none' | 'bearer' | 'api_key' | 'csrf';
  token?: string;
  headerName?: string;
  includeVectorPdf: boolean;
}

export interface IDataSyncAdapter {
  readonly adapterId: string;
  readonly displayName: string;
  pushDocumentState(envelope: QCadExportEnvelope, config?: EndpointConfig): Promise<SyncResult>;
  pullDocumentData?(drawingNo: string, pageNumber?: number): Promise<Partial<QCadExportEnvelope>>;
}
