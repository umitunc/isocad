import { ExportArtifact, ExportContext, IExporter } from '../core/interfaces/IExporter';

export class DxfExporter implements IExporter {
  public readonly formatId = 'dxf';
  public readonly label = 'AutoCAD DXF (.dxf)';

  public async export(context: ExportContext): Promise<ExportArtifact> {
    const lines: string[] = [
      '0', 'SECTION',
      '2', 'ENTITIES',
    ];

    const pageH = context.pageDimensionsPt[0]?.height ?? 842;

    for (const ent of context.entities) {
      if (!ent.visible) continue;
      for (const l of ent.toRenderPrimitives(false, false)) {
        lines.push(
          '0', 'LINE',
          '8', ent.layerId,
          '10', l.x1.toFixed(3),
          '20', (pageH - l.y1).toFixed(3),
          '30', '0.0',
          '11', l.x2.toFixed(3),
          '21', (pageH - l.y2).toFixed(3),
          '31', '0.0',
        );
      }
    }

    lines.push('0', 'ENDSEC', '0', 'EOF');
    const content = lines.join('\n');
    return {
      blob: new Blob([content], { type: 'application/dxf' }),
      filename: `${context.drawingNo || 'drawing'}_qcad.dxf`,
      mimeType: 'application/dxf',
    };
  }
}
