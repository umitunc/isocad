import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import { Point2D } from '../../core/interfaces/ICadEntity';
import { cycleIsoplane } from '../../core/math/IsometricProjection';
import { useLocaleStore } from '../../i18n/useLocaleStore';
import { useEditorStore } from '../../store/useEditorStore';

interface CommandLineBarProps {
  cursorWorld: Point2D;
  cliStatus: string;
  onExecuteCommand: (raw: string) => void;
}

export const CommandLineBar: React.FC<CommandLineBarProps> = ({
  cursorWorld,
  cliStatus,
  onExecuteCommand,
}) => {
  const { t } = useLocaleStore();
  const { orthoEnabled, isoplaneMode, gridVisible, showRulers, setField } = useEditorStore();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onExecuteCommand(input);
    setInput('');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#070b12] px-3 py-1.5 text-[11px] font-mono">
      <form onSubmit={handleSubmit} className="flex flex-1 min-w-[240px] items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="text-slate-500">Command:</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.editor.cmdPlaceholder}
          className="flex-1 bg-transparent text-cyan-200 placeholder-slate-600 focus:outline-none"
        />
        {cliStatus && <span className="text-[10px] text-amber-300/90 hidden sm:inline">{cliStatus}</span>}
      </form>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setField('orthoEnabled', !orthoEnabled)}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            orthoEnabled
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
              : 'border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          ORTHO (F8)
        </button>
        <button
          type="button"
          onClick={() => setField('isoplaneMode', cycleIsoplane(isoplaneMode))}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            isoplaneMode !== 'OFF'
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
              : 'border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          ISO: {isoplaneMode} (F5)
        </button>
        <button
          type="button"
          onClick={() => setField('gridVisible', !gridVisible)}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            gridVisible
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
              : 'border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          GRID
        </button>
        <button
          type="button"
          onClick={() => setField('showRulers', !showRulers)}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            showRulers
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
              : 'border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          RULER
        </button>
        <span className="ml-2 text-slate-400">
          X: <span className="text-cyan-300">{cursorWorld.x.toFixed(1)}</span> Y:{' '}
          <span className="text-cyan-300">{cursorWorld.y.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
};
