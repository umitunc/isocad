import { ICadTool } from '../interfaces/ICadTool';

export class CommandLineInterpreter {
  private readonly aliasMap: Record<string, string> = {
    L: 'line',
    LINE: 'line',
    AR: 'arrow',
    ARROW: 'arrow',
    PL: 'polyline',
    PLINE: 'polyline',
    C: 'circle',
    CIRCLE: 'circle',
    REC: 'rect',
    RECT: 'rect',
    CLOUD: 'revcloud',
    REVCLOUD: 'revcloud',
    DIM: 'dimension',
    DIST: 'dimension',
    T: 'text',
    TEXT: 'text',
    FJ: 'stamp_triangle',
    SJ: 'stamp_circle',
    SP: 'stamp_rect',
    ESC: 'select',
    SEL: 'select',
  };

  public parseCommand(
    raw: string,
    activeTool: ICadTool | null,
    switchTool: (toolName: string) => void,
    onAction?: (action: 'UNDO' | 'REDO' | 'ZOOM_FIT' | 'ORTHO' | 'ISO') => void,
  ): { handled: boolean; feedback: string } {
    const clean = raw.trim();
    if (!clean) return { handled: false, feedback: '' };

    // First give active tool a chance (e.g. @150<30 coordinate entry)
    if (activeTool?.onCommandInput?.(clean)) {
      return { handled: true, feedback: `Point: ${clean}` };
    }

    const upper = clean.toUpperCase();
    if (upper === 'U' || upper === 'UNDO') {
      onAction?.('UNDO');
      return { handled: true, feedback: 'Undo executed' };
    }
    if (upper === 'REDO') {
      onAction?.('REDO');
      return { handled: true, feedback: 'Redo executed' };
    }
    if (upper === 'ZE' || upper === 'FIT' || upper === 'Z') {
      onAction?.('ZOOM_FIT');
      return { handled: true, feedback: 'Zoom Extents' };
    }
    if (upper === 'ORTHO' || upper === 'F8') {
      onAction?.('ORTHO');
      return { handled: true, feedback: 'Toggled ORTHO' };
    }
    if (upper === 'ISO' || upper === 'ISOPLANE' || upper === 'F5') {
      onAction?.('ISO');
      return { handled: true, feedback: 'Cycled ISOPLANE' };
    }

    const mapped = this.aliasMap[upper];
    if (mapped) {
      switchTool(mapped);
      return { handled: true, feedback: `Tool: ${mapped.toUpperCase()}` };
    }

    return { handled: false, feedback: `Unknown command: "${clean}"` };
  }
}
