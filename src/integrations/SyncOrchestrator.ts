import {
  EndpointConfig,
  IDataSyncAdapter,
  QCadExportEnvelope,
  SyncResult,
} from '../core/interfaces/IDataSyncAdapter';
import { DemoMockSyncAdapter } from './DemoMockSyncAdapter';
import { PostMessageBridge } from './PostMessageBridge';
import { RestWebhookAdapter } from './RestWebhookAdapter';
import { LaravelApiAdapter } from './LaravelApiAdapter';

export class SyncOrchestrator {
  private adapters = new Map<string, IDataSyncAdapter>();

  constructor() {
    this.register(new DemoMockSyncAdapter());
    this.register(new RestWebhookAdapter());
    this.register(new LaravelApiAdapter());
    this.register(new PostMessageBridge());
  }

  public register(adapter: IDataSyncAdapter): void {
    this.adapters.set(adapter.adapterId, adapter);
  }

  public getAdapters(): IDataSyncAdapter[] {
    return Array.from(this.adapters.values());
  }

  public async sync(
    adapterId: string,
    envelope: QCadExportEnvelope,
    config?: EndpointConfig,
  ): Promise<SyncResult> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      return {
        success: false,
        statusCode: 0,
        endpointUrl: '',
        message: `Unknown adapter: ${adapterId}`,
        durationMs: 0,
      };
    }
    return adapter.pushDocumentState(envelope, config);
  }
}

export const syncOrchestrator = new SyncOrchestrator();
