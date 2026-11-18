export type ComponentCategory =
  | 'PIPE'
  | 'FITTINGS'
  | 'FLANGES'
  | 'GASKETS'
  | 'VALVES'
  | 'SUPPORTS'
  | 'INSTRUMENTS'
  | 'BOLTS';

export interface PdfWordToken {
  text: string;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface ContinuationLink {
  type: 'ON' | 'FROM' | 'TO';
  target: string;
}

export interface PipingPageContext {
  pageNum: number;
  width: number;
  height: number;
  text: string;
  annotText: string;
  fullText: string;
  words: PdfWordToken[];
  lineNo: string;
  revNo: string;
  sheetNo: string;
  hasDrawing: boolean;
  hasMto: boolean;
  continuation: ContinuationLink | null;
}

export interface MTOItem {
  lineNo: string;
  revNo: string;
  sheetNo: string;
  itemNo: string;
  component: ComponentCategory;
  description: string;
  sizeDn: string;
  danCode: string;
  qty: string;
  unit: 'M' | 'ADT';
  weight: string;
}

export interface CutItem {
  lineNo: string;
  sheetNo: string;
  pieceNo: string;
  length: string;
  sizeDn: string;
  endPrep: string;
  remarks: string;
}

export interface SupportItem {
  lineNo: string;
  revNo: string;
  sheetNo: string;
  supportRef: string;
  supportType: 'Spring' | 'Guide' | 'Hold-Down' | 'Rest' | 'U-Bolt' | 'Hanger' | 'Rigid';
  description: string;
  sizeDn: string;
  quantity: string;
}

export interface WeldJoint {
  lineNo: string;
  jointNo: number;
  revNo: string;
  sheetNo: string;
  item1: string;
  desc1: string;
  danCode1: string;
  size1Dn: string;
  size1Mm: string;
  size1Inch: string;
  thk1Mm: string;
  item2: string;
  desc2: string;
  danCode2: string;
  size2Dn: string;
  size2Mm: string;
  size2Inch: string;
  thk2Mm: string;
  anchorWorld?: { x: number; y: number };
}

export interface JointWidgetMeta {
  shapeId: string;
  shapeType: 'triangle' | 'circle' | 'rect' | 'hexagon';
  typeOfJoint: 'F' | 'S' | '';
  typeOfWelds: string;
  jointNo: string;
  drawJointNo: string;
  weldingDate: string;
  spoolNo1: string;
  spoolNo2: string;
  poseNo1: string;
  poseNo2: string;
  member1: string;
  member2: string;
  material: string;
  dia1: string;
  dia2: string;
  nps1: string;
  nps2: string;
  thickness1: string;
  thickness2: string;
  danCode1: string;
  danCode2: string;
  welderId: string;
}

export interface PipingExtractionResult {
  lineNo: string;
  revNo: string;
  pages: PipingPageContext[];
  mto: MTOItem[];
  cuts: CutItem[];
  supports: SupportItem[];
  welds: WeldJoint[];
}
