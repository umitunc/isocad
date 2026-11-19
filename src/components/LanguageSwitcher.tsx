import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LocaleCode } from '../i18n/types';
import { useLocaleStore } from '../i18n/useLocaleStore';

const LOCALES: Array<{ code: LocaleCode; label: string; name: string }> = [
  { code: 'tr', label: 'TR', name: 'Türkçe' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ru', label: 'RU', name: 'Русский' },
];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocaleStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const current = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

  return (
    <div ref={containerRef} className="relative inline-block text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono transition-colors cursor-pointer ${
          open
            ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
            : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Globe className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="font-semibold">{current.label}</span>
        <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-36 rounded-xl border border-slate-700 bg-[#0b1120] p-1 shadow-2xl z-50"
        >
          {LOCALES.map((item) => {
            const active = locale === item.code;
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] opacity-80">{item.label}</span>
                  <span>{item.name}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
