import React from 'react';
import {
  MousePointer,
  Hand,
  Minus,
  MoveUpRight,
  GitCommitHorizontal,
  Circle,
  Square,
  Triangle,
  Cloud,
  Ruler,
  Type,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';

interface FloatingCadToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: (tool: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSaveSnapshot: () => void;
}

const TOOLS: Array<{ id: string; label: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'Select (ESC)', icon: <MousePointer className="h-4 w-4" /> },
  { id: 'pan', label: 'Pan (Space)', icon: <Hand className="h-4 w-4" /> },
  { id: 'line', label: 'Line (L)', icon: <Minus className="h-4 w-4" /> },
  { id: 'arrow', label: 'Arrow (AR)', icon: <MoveUpRight className="h-4 w-4" /> },
  { id: 'polyline', label: 'Polyline (PL)', icon: <GitCommitHorizontal className="h-4 w-4" /> },
  { id: 'circle', label: 'Circle (C)', icon: <Circle className="h-4 w-4" /> },
  { id: 'rect', label: 'Rectangle (REC)', icon: <Square className="h-4 w-4" /> },
  { id: 'revcloud', label: 'RevCloud (CLOUD)', icon: <Cloud className="h-4 w-4" /> },
  { id: 'dimension', label: 'Dimension (DIM)', icon: <Ruler className="h-4 w-4" /> },
  { id: 'text', label: 'Text (T)', icon: <Type className="h-4 w-4" /> },
  { id: 'stamp_triangle', label: 'Field Weld Stamp (FJ)', icon: <Triangle className="h-4 w-4 text-rose-400" /> },
  { id: 'stamp_circle', label: 'Shop Weld Stamp (SJ)', icon: <Circle className="h-4 w-4 text-amber-400" /> },
  { id: 'stamp_rect', label: 'Spool Stamp (SP)', icon: <Square className="h-4 w-4 text-emerald-400" /> },
];

export const FloatingCadToolbar: React.FC<FloatingCadToolbarProps> = ({
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onPrevPage,
  onNextPage,
  onSaveSnapshot,
}) => {
  const { activeTool, strokeColor, zoom, currentPage, totalPages, setField } = useEditorStore();

  return (
    <div className="pointer-events-none absolute bottom-10 left-0 right-0 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl liquid-glass px-3 py-2">
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              onClick={() => onSelectTool(tool.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                activeTool === tool.id
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/25'
                  : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setField('strokeColor', e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
            title="Stroke Color"
          />
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteSelected}
            title="Delete Selected (Del)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-950/50 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onSaveSnapshot}
            title="Save Version Snapshot"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-950/50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-r border-slate-700 pr-2 font-mono text-xs">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[44px] text-center text-cyan-300">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            title="Fit to Screen"
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={onPrevPage}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-1.5 text-slate-300">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={onNextPage}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
