import { PipingPageContext, MTOItem } from '../../piping-domain/types/PipingModels';

export interface IPipingParserStrategy {
  readonly strategyId: string;
  readonly priority: number;
  canParse(page: PipingPageContext): boolean;
  parseMTO(page: PipingPageContext, lineNo: string, revNo: string, sheetNo: string): MTOItem[];
}
