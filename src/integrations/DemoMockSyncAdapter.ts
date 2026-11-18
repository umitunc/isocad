import {
  EndpointConfig,
  IDataSyncAdapter,
  QCadExportEnvelope,
  SyncResult,
} from '../core/interfaces/IDataSyncAdapter';

export class DemoMockSyncAdapter implements IDataSyncAdapter {
  public readonly adapterId = 'demo-simulator';
  public readonly displayName = 'Demo Sandbox API Simulator';

  public async pushDocumentState(
    envelope: QCadExportEnvelope,
    config?: EndpointConfig,
  ): Promise<SyncResult> {
    await new Promise((r) => setTimeout(r, 180));
    return {
      success: true,
      statusCode: 200,
      endpointUrl: config?.url || 'https://sandbox.qcad.dev/api/v1/weldmap/sync',
      message: `200 OK • Synced ${envelope.annotations.length} stamps, ${envelope.pipingData.mto.length} MTO & ${envelope.pipingData.weldLog.length} Weld Log rows`,
      remotePayload: {
        ok: true,
        revisionId: `REV-${envelope.document.revisionNo}-${Date.now().toString().slice(-4)}`,
        stage: envelope.stage,
        drawingNo: envelope.document.drawingNo,
        receivedBytes: JSON.stringify(envelope).length,
      },
      durationMs: 42,
    };
  }
}
