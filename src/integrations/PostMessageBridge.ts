import {
  EndpointConfig,
  IDataSyncAdapter,
  QCadExportEnvelope,
  SyncResult,
} from '../core/interfaces/IDataSyncAdapter';

export class PostMessageBridge implements IDataSyncAdapter {
  public readonly adapterId = 'postmessage-iframe';
  public readonly displayName = 'Host Application Iframe Bridge (postMessage)';

  public async pushDocumentState(
    envelope: QCadExportEnvelope,
    config?: EndpointConfig,
  ): Promise<SyncResult> {
    const start = performance.now();
    const targetOrigin = config?.url?.startsWith('http') ? config.url : '*';
    const message = {
      source: 'QCAD_EDITOR',
      type: 'QCAD_DOCUMENT_SAVED',
      payload: envelope,
    };

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, targetOrigin);
    } else {
      window.postMessage(message, '*');
    }

    return {
      success: true,
      statusCode: 200,
      endpointUrl: `postMessage://${targetOrigin}`,
      message: `Dispatched QCAD_DOCUMENT_SAVED (${envelope.annotations.length} stamps)`,
      remotePayload: { dispatched: true, targetOrigin },
      durationMs: Math.round(performance.now() - start),
    };
  }
}
