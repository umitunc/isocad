import { ExportArtifact, ExportContext, IExporter } from '../core/interfaces/IExporter';

export class JsonPayloadExporter implements IExporter {
  public readonly formatId = 'json';
  public readonly label = 'QCad JSON Envelope (.json)';

  public async export(context: ExportContext): Promise<ExportArtifact> {
    const payload = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      document: {
        drawingNo: context.drawingNo,
        revisionNo: context.revisionNo,
        pageCount: context.pageCount,
      },
      pipingData: context.pipingData,
      cadEntities: context.entities.map((e) => e.serialize()),
    };
    const json = JSON.stringify(payload, null, 2);
    return {
      blob: new Blob([json], { type: 'application/json' }),
      filename: `${context.drawingNo || 'qcad_export'}.json`,
      mimeType: 'application/json',
    };
  }
}
