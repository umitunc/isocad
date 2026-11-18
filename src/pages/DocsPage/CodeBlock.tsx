import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const TS_KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'async', 'await', 'return',
  'interface', 'type', 'class', 'new', 'if', 'else', 'function', 'true', 'false', 'null',
]);

function highlightLine(line: string, lang: string, isLight: boolean): React.ReactNode[] {
  if (line.trim().startsWith('//') || line.trim().startsWith('<!--')) {
    return [<span key="cmt" className={isLight ? 'text-slate-500 italic' : 'text-slate-500 italic'}>{line}</span>];
  }

  const tokens = line.split(/("[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|[{}()[\]:.,=<>\/])/g);
  return tokens.map((tok, i) => {
    if (!tok) return null;
    if (tok.startsWith('"') || tok.startsWith("'")) {
      const next = tokens[i + 1] ?? '';
      if (lang === 'json' && next.trim().startsWith(':')) {
        return <span key={i} className={isLight ? 'text-cyan-700' : 'text-cyan-300'}>{tok}</span>;
      }
      return <span key={i} className={isLight ? 'text-emerald-700' : 'text-emerald-300'}>{tok}</span>;
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      return <span key={i} className={isLight ? 'text-amber-700' : 'text-amber-300'}>{tok}</span>;
    }
    if (TS_KEYWORDS.has(tok)) {
      return <span key={i} className={isLight ? 'text-purple-700 font-semibold' : 'text-purple-400 font-semibold'}>{tok}</span>;
    }
    if (/^(iframe|script|div|QCAD_EDITOR|QCAD_DOCUMENT_SAVED|SyncOrchestrator|syncOrchestrator|fetch|JSON|window|console)$/.test(tok)) {
      return <span key={i} className={isLight ? 'text-sky-700' : 'text-sky-300'}>{tok}</span>;
    }
    if (/^[{}()[\]:.,=<>\/]$/.test(tok)) {
      return <span key={i} className={isLight ? 'text-slate-500' : 'text-slate-400'}>{tok}</span>;
    }
    return <span key={i} className={isLight ? 'text-slate-900' : 'text-slate-200'}>{tok}</span>;
  });
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'typescript' }) => {
  const [copied, setCopied] = useState(false);
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const lines = code.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={
        isLight
          ? 'rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm'
          : 'rounded-xl border border-slate-800/90 bg-[#060a12] overflow-hidden shadow-inner'
      }
    >
      <div
        className={
          isLight
            ? 'flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-[10px] font-mono'
            : 'flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2 text-[10px] font-mono'
        }
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-500/70" />
          <span className="h-2 w-2 rounded-full bg-amber-500/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
          <span className={`ml-2 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {language}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 cursor-pointer ${
            isLight ? 'text-cyan-700 hover:bg-slate-200' : 'text-cyan-300 hover:bg-slate-800'
          }`}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto p-4 text-xs font-mono leading-relaxed">
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            <span
              className={`w-8 shrink-0 select-none text-right pr-4 ${
                isLight ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {idx + 1}
            </span>
            <span className="whitespace-pre">{highlightLine(line, language, isLight)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
