import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  X,
  Wrench,
} from 'lucide-react';
import { useLocaleStore } from '../../i18n/useLocaleStore';
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

interface ToolbarLayoutState {
  x: number | null;
  y: number | null;
  width: number | null;
  visible: boolean;
}

const TOOLBAR_STORAGE_KEY = 'isocad_floating_toolbar_v1';
const VIEWPORT_PADDING = 8;
const MIN_TOOLBAR_WIDTH = 64;

const DEFAULT_LAYOUT: ToolbarLayoutState = {
  x: null,
  y: null,
  width: null,
  visible: true,
};

const UI_LABELS = {
  tr: {
    moveHint: 'Taşı (Sürükle) • Çift tık: Konumu sıfırla',
    resizeHint: 'Boyutlandır (Sürükle) • Çift tık: Otomatik genişlik',
    close: 'Araç çubuğunu kapat',
    reopen: 'Araç Çubuğu',
  },
  en: {
    moveHint: 'Move (Drag) • Double-click: Reset position',
    resizeHint: 'Resize (Drag) • Double-click: Auto width',
    close: 'Close toolbar',
    reopen: 'Toolbar',
  },
  ru: {
    moveHint: 'Переместить • Двойной клик: сброс',
    resizeHint: 'Изменить размер • Двойной клик: авто',
    close: 'Закрыть панель',
    reopen: 'Панель',
  },
} as const;

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), Math.max(min, max));
}

/**
 * Finds the minimum toolbar width (in px) where all wrapped items fit within
 * `maxH` without vertical overflow/scrolling.
 */
function findMinWidthFittingHeight(
  el: HTMLElement,
  maxH: number,
  minW: number,
  maxW: number
): number {
  if (maxH <= 0 || minW >= maxW) return minW;

  const prevWidth = el.style.width;
  const prevMaxHeight = el.style.maxHeight;

  try {
    el.style.maxHeight = 'none';
    el.style.width = `${minW}px`;
    if (el.scrollHeight <= maxH) {
      return minW;
    }

    let lo = minW;
    let hi = maxW;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.width = `${mid}px`;
      if (el.scrollHeight <= maxH) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    return lo;
  } finally {
    el.style.width = prevWidth;
    el.style.maxHeight = prevMaxHeight;
  }
}

function loadToolbarLayout(): ToolbarLayoutState {
  try {
    const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<ToolbarLayoutState>;
    return {
      x: typeof parsed.x === 'number' && Number.isFinite(parsed.x) ? parsed.x : null,
      y: typeof parsed.y === 'number' && Number.isFinite(parsed.y) ? parsed.y : null,
      width:
        typeof parsed.width === 'number' && Number.isFinite(parsed.width)
          ? Math.max(MIN_TOOLBAR_WIDTH, parsed.width)
          : null,
      visible: typeof parsed.visible === 'boolean' ? parsed.visible : true,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveToolbarLayout(state: ToolbarLayoutState): void {
  try {
    localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

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
  const { locale } = useLocaleStore();
  const labels = UI_LABELS[locale];

  const [layout, setLayout] = useState<ToolbarLayoutState>(() => loadToolbarLayout());
  const [isInteracting, setIsInteracting] = useState(false);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const clampLayoutToParent = (candidate: ToolbarLayoutState): ToolbarLayoutState => {
    const el = toolbarRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return candidate;

    const parentW = parent.clientWidth;
    const parentH = parent.clientHeight;
    if (parentW <= 0 || parentH <= 0) return candidate;

    const maxAllowedW = Math.max(MIN_TOOLBAR_WIDTH, parentW - VIEWPORT_PADDING * 2);
    const maxAllowedH = Math.max(0, parentH - VIEWPORT_PADDING * 2);
    const minAllowedW = findMinWidthFittingHeight(el, maxAllowedH, MIN_TOOLBAR_WIDTH, maxAllowedW);
    const nextWidth =
      candidate.width !== null ? clamp(candidate.width, minAllowedW, maxAllowedW) : null;

    const rect = el.getBoundingClientRect();
    const effectiveW = Math.min(nextWidth ?? rect.width, maxAllowedW);
    const effectiveH = Math.min(rect.height, maxAllowedH);

    const nextX =
      candidate.x !== null
        ? clamp(candidate.x, VIEWPORT_PADDING, parentW - effectiveW - VIEWPORT_PADDING)
        : null;
    const nextY =
      candidate.y !== null
        ? clamp(candidate.y, VIEWPORT_PADDING, parentH - effectiveH - VIEWPORT_PADDING)
        : null;

    return {
      ...candidate,
      x: nextX,
      y: nextY,
      width: nextWidth,
    };
  };

  useLayoutEffect(() => {
    if (!layout.visible) return;
    if (isInteracting) {
      const el = toolbarRef.current;
      const parent = el?.parentElement;
      if (!el || !parent || layout.y === null) return;
      const maxY = Math.max(VIEWPORT_PADDING, parent.clientHeight - el.offsetHeight - VIEWPORT_PADDING);
      if (layout.y > maxY) {
        setLayout((prev) => (prev.y !== null && prev.y > maxY ? { ...prev, y: Math.round(maxY) } : prev));
      }
      return;
    }
    const clamped = clampLayoutToParent(layout);
    const changed =
      clamped.x !== layout.x || clamped.y !== layout.y || clamped.width !== layout.width;
    if (changed) {
      setLayout(clamped);
      saveToolbarLayout(clamped);
    }
  }, [layout.visible, layout.x, layout.y, layout.width, isInteracting]);

  useEffect(() => {
    const parent = toolbarRef.current?.parentElement;
    if (!parent) return;

    const handleParentResize = () => {
      if (!layoutRef.current.visible) return;
      const clamped = clampLayoutToParent(layoutRef.current);
      const cur = layoutRef.current;
      if (clamped.x !== cur.x || clamped.y !== cur.y || clamped.width !== cur.width) {
        setLayout(clamped);
        saveToolbarLayout(clamped);
      }
    };

    const observer = new ResizeObserver(handleParentResize);
    observer.observe(parent);
    window.addEventListener('resize', handleParentResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleParentResize);
    };
  }, [layout.visible]);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-resize-handle]')) return;

    e.preventDefault();
    e.stopPropagation();

    const el = toolbarRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const rect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const startX = layoutRef.current.x ?? rect.left - parentRect.left;
    const startY = layoutRef.current.y ?? rect.top - parentRect.top;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    setIsInteracting(true);
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      const curRect = el.getBoundingClientRect();
      const maxX = Math.max(VIEWPORT_PADDING, parent.clientWidth - curRect.width - VIEWPORT_PADDING);
      const maxY = Math.max(VIEWPORT_PADDING, parent.clientHeight - curRect.height - VIEWPORT_PADDING);
      const nextX = Math.round(clamp(startX + dx, VIEWPORT_PADDING, maxX));
      const nextY = Math.round(clamp(startY + dy, VIEWPORT_PADDING, maxY));

      setLayout((prev) => ({ ...prev, x: nextX, y: nextY }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = prevUserSelect;
      setIsInteracting(false);
      saveToolbarLayout(layoutRef.current);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = toolbarRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const rect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const lockedX = Math.round(layoutRef.current.x ?? rect.left - parentRect.left);
    const lockedY = Math.round(layoutRef.current.y ?? rect.top - parentRect.top);
    const startWidth = rect.width;
    const startClientX = e.clientX;
    const maxAllowedW = Math.max(MIN_TOOLBAR_WIDTH, parent.clientWidth - VIEWPORT_PADDING * 2);
    const maxAllowedH = Math.max(0, parent.clientHeight - VIEWPORT_PADDING * 2);
    const minWidthForHeight = findMinWidthFittingHeight(
      el,
      maxAllowedH,
      MIN_TOOLBAR_WIDTH,
      maxAllowedW
    );
    const maxWidth = Math.max(
      minWidthForHeight,
      parent.clientWidth - lockedX - VIEWPORT_PADDING
    );

    setIsInteracting(true);
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const nextWidth = Math.round(clamp(startWidth + dx, minWidthForHeight, maxWidth));
      const nextX = Math.round(
        clamp(lockedX, VIEWPORT_PADDING, parent.clientWidth - nextWidth - VIEWPORT_PADDING)
      );
      setLayout((prev) => ({
        ...prev,
        x: nextX,
        y: lockedY,
        width: nextWidth,
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = prevUserSelect;
      setIsInteracting(false);
      const clamped = clampLayoutToParent(layoutRef.current);
      setLayout(clamped);
      saveToolbarLayout(clamped);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleResetPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-resize-handle]')) return;
    const next: ToolbarLayoutState = { x: null, y: null, width: null, visible: true };
    setLayout(next);
    saveToolbarLayout(next);
  };

  const handleResetWidth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: ToolbarLayoutState = { ...layoutRef.current, width: null };
    setLayout(next);
    saveToolbarLayout(next);
  };

  const handleSetVisible = (visible: boolean) => {
    const next: ToolbarLayoutState = { ...layoutRef.current, visible };
    setLayout(next);
    saveToolbarLayout(next);
  };

  if (!layout.visible) {
    return (
      <button
        type="button"
        onClick={() => handleSetVisible(true)}
        onPointerDown={(e) => e.stopPropagation()}
        title={labels.reopen}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full liquid-glass px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/50 hover:text-cyan-300 transition-colors cursor-pointer shadow-lg"
      >
        <Wrench className="h-3.5 w-3.5 text-cyan-400" />
        <span>{labels.reopen}</span>
      </button>
    );
  }

  const hasCustomPos = layout.x !== null && layout.y !== null;
  const containerStyle: React.CSSProperties = hasCustomPos
    ? {
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: layout.width !== null ? `${layout.width}px` : undefined,
        maxWidth: `calc(100% - ${VIEWPORT_PADDING * 2}px)`,
        maxHeight: `calc(100% - ${VIEWPORT_PADDING * 2}px)`,
      }
    : {
        left: '50%',
        bottom: '2.5rem',
        transform: 'translateX(-50%)',
        width: layout.width !== null ? `${layout.width}px` : undefined,
        maxWidth: `calc(100% - ${VIEWPORT_PADDING * 2}px)`,
        maxHeight: `calc(100% - ${VIEWPORT_PADDING * 2}px)`,
      };

  return (
    <div
      ref={toolbarRef}
      style={containerStyle}
      onPointerDown={(e) => {
        e.stopPropagation();
        handleDragStart(e);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={handleResetPosition}
      className="absolute z-20 flex flex-wrap items-center gap-1.5 rounded-2xl liquid-glass px-3 py-2 overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
    >
      {/* Drawing & Stamp Tools */}
      <div className="flex flex-wrap items-center gap-1">
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

      {/* Color, Undo/Redo, Delete, Save */}
      <div className="flex flex-wrap items-center gap-1">
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

      {/* Zoom Controls */}
      <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
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

      {/* Page Navigation */}
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

      {/* Close Button */}
      <button
        type="button"
        onClick={() => handleSetVisible(false)}
        title={labels.close}
        aria-label={labels.close}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Invisible Right Edge & Bottom-Right Corner Resize Hit Zones */}
      <div
        data-resize-handle="right"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResetWidth}
        title={labels.resizeHint}
        className="absolute top-2 bottom-3 right-0 w-2 cursor-ew-resize touch-none"
      />
      <div
        data-resize-handle="corner"
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResetWidth}
        title={labels.resizeHint}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize touch-none"
      />
    </div>
  );
};
