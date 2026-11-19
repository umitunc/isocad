import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  Code2,
  Copy,
  Cpu,
  Download,
  FileDown,
  FileSpreadsheet,
  FolderOpen,
  Minus,
  Send,
  Square,
  Stamp,
  Upload,
  X,
} from 'lucide-react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useLocaleStore } from '../../i18n/useLocaleStore';

interface EditorMenuBarProps {
  onUploadPdf: () => void;
  onAutoExtract: () => void;
  onAutoStamp: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onExportDxf: () => void;
  onOpenPushApi: () => void;
}

type MenuId = 'piping' | 'export' | null;

const MENU_LABELS = {
  tr: { piping: 'PDF & Piping', export: 'Dışa Aktar' },
  en: { piping: 'PDF & Piping', export: 'Export' },
  ru: { piping: 'PDF и Piping', export: 'Экспорт' },
} as const;

export const EditorMenuBar: React.FC<EditorMenuBarProps> = ({
  onUploadPdf,
  onAutoExtract,
  onAutoStamp,
  onExportPdf,
  onExportExcel,
  onExportDxf,
  onOpenPushApi,
}) => {
  const { locale, t } = useLocaleStore();
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const labels = MENU_LABELS[locale];
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron) return;
    let mounted = true;
    void api.isWindowMaximized().then((max) => {
      if (mounted) setIsMaximized(max);
    });
    const unsubscribe = api.onWindowMaximizedChange((max) => {
      setIsMaximized(max);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const runAction = (fn: () => void) => {
    setOpenMenu(null);
    fn();
  };

  return (
    <div
      ref={barRef}
      className={`ml-auto flex items-center justify-end gap-1.5 text-xs ${
        isElectron ? 'flex-nowrap shrink-0' : 'flex-wrap'
      }`}
    >
      {/* Menu 1: PDF & Piping */}
      <div
        className="relative"
        onMouseEnter={() => {
          if (openMenu !== null) setOpenMenu('piping');
        }}
      >
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'piping' ? null : 'piping'))}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
            openMenu === 'piping'
              ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5 text-cyan-400" />
          <span>{labels.piping}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        {openMenu === 'piping' && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-700 bg-[#0b1120] p-1.5 shadow-2xl z-50">
            <button
              type="button"
              onClick={() => runAction(onUploadPdf)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{t.editor.uploadPdf}</span>
            </button>
            <button
              type="button"
              onClick={() => runAction(onAutoExtract)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{t.editor.autoExtract}</span>
            </button>
            <button
              type="button"
              onClick={() => runAction(onAutoStamp)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Stamp className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{t.editor.autoStamp}</span>
            </button>
          </div>
        )}
      </div>

      {/* Menu 2: Export */}
      <div
        className="relative"
        onMouseEnter={() => {
          if (openMenu !== null) setOpenMenu('export');
        }}
      >
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
            openMenu === 'export'
              ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          <span>{labels.export}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        {openMenu === 'export' && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-700 bg-[#0b1120] p-1.5 shadow-2xl z-50">
            <button
              type="button"
              onClick={() => runAction(onExportPdf)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span>{t.editor.exportPdf}</span>
            </button>
            <button
              type="button"
              onClick={() => runAction(onExportExcel)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>{t.editor.exportExcel}</span>
            </button>
            <button
              type="button"
              onClick={() => runAction(onExportDxf)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Code2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>{t.editor.exportDxf}</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary CTA: Push to Endpoint */}
      <button
        type="button"
        onClick={onOpenPushApi}
        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 font-semibold text-white hover:bg-cyan-500 cursor-pointer"
      >
        <Send className="h-3.5 w-3.5" />
        {t.editor.pushApi}
      </button>

      {/* Docs (web only) + Theme + Language */}
      {!isElectron && (
        <Link
          to="/docs"
          className="hidden sm:inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {t.nav.docs}
        </Link>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      {/* Frameless Electron Window Controls */}
      {isElectron && (
        <div className="ml-1 flex shrink-0 items-center gap-0.5 border-l border-slate-800 pl-2">
          <button
            type="button"
            onClick={() => window.electronAPI?.minimizeWindow()}
            aria-label="Minimize"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.toggleMaximizeWindow()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
          >
            {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.closeWindow()}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-600 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
