import {
  EndpointConfig,
  IDataSyncAdapter,
  QCadExportEnvelope,
  SyncResult,
} from '../core/interfaces/IDataSyncAdapter';

export class RestWebhookAdapter implements IDataSyncAdapter {
  public readonly adapterId = 'rest-webhook';
  public readonly displayName = 'Generic REST / Webhook API';

  public async pushDocumentState(
    envelope: QCadExportEnvelope,
    config?: EndpointConfig,
  ): Promise<SyncResult> {
    const start = performance.now();
    const url = config?.url?.trim();
    if (!url) {
      return {
        success: false,
        statusCode: 0,
        endpointUrl: '',
        message: 'Target endpoint URL is required.',
        durationMs: 0,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.authType === 'bearer' && config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    } else if (config?.authType === 'api_key' && config.token) {
      headers[config.headerName || 'X-API-Key'] = config.token;
    }

    try {
      const resp = await fetch(url, {
        method: config?.method ?? 'POST',
        headers,
        body: JSON.stringify(envelope),
      });
      const text = await resp.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // plain text response
      }

      return {
        success: resp.ok,
        statusCode: resp.status,
        endpointUrl: url,
        message: resp.ok
          ? `Synced ${envelope.annotations.length} annotations & ${envelope.pipingData.weldLog.length} joints`
          : `HTTP ${resp.status}: ${resp.statusText}`,
        remotePayload: parsed,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        endpointUrl: url,
        message: err instanceof Error ? err.message : 'Network error',
        durationMs: Math.round(performance.now() - start),
      };
    }
  }
}
