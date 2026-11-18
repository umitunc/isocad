import { ICadEntity } from './ICadEntity';
import { PipingExtractionResult } from '../../piping-domain/types/PipingModels';

export interface ExportContext {
  originalPdfBytes?: Uint8Array;
  entities: ICadEntity[];
  pipingData: PipingExtractionResult;
  pageCount: number;
  pageDimensionsPt: Array<{ width: number; height: number }>;
  documentTitle: string;
  drawingNo: string;
  revisionNo: string;
}

export interface ExportArtifact {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export interface IExporter {
  readonly formatId: 'pdf' | 'xlsx' | 'dxf' | 'json';
  readonly label: string;
  export(context: ExportContext): Promise<ExportArtifact>;
}
