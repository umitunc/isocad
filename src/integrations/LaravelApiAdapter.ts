import {
  EndpointConfig,
  IDataSyncAdapter,
  QCadExportEnvelope,
  SyncResult,
} from '../core/interfaces/IDataSyncAdapter';

/**
 * Drop-in adapter compatible with Laravel / ERP REST backend endpoints:
 * - POST /api/pdf-editor/annotations/sync
 * - POST /api/pdf-editor/save-joint-data
 * - POST /export-pdf (save_to_revision=true)
 */
export class LaravelApiAdapter implements IDataSyncAdapter {
  public readonly adapterId = 'laravel-erp';
  public readonly displayName = 'Laravel / ERP REST API';

  public async pushDocumentState(
    envelope: QCadExportEnvelope,
    config?: EndpointConfig,
  ): Promise<SyncResult> {
    const start = performance.now();
    const baseUrl = (config?.url || window.location.origin).replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const csrf =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || config?.token;
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;

    try {
      const syncResp = await fetch(`${baseUrl}/api/pdf-editor/annotations/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pdf_file: envelope.document.drawingNo,
          page_number: Number.parseInt(envelope.document.sheetNo, 10) || 1,
          annotations: envelope.annotations,
        }),
      });

      const body = await syncResp.json().catch(() => ({}));
      return {
        success: syncResp.ok,
        statusCode: syncResp.status,
        endpointUrl: `${baseUrl}/api/pdf-editor/annotations/sync`,
        message: syncResp.ok
          ? `ERP Sync OK (${envelope.stage})`
          : `ERP Sync failed (${syncResp.status})`,
        remotePayload: body,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        endpointUrl: `${baseUrl}/api/pdf-editor/annotations/sync`,
        message: err instanceof Error ? err.message : 'ERP API unreachable',
        durationMs: Math.round(performance.now() - start),
      };
    }
  }
}
