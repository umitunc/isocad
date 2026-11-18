import React from 'react';
import { LocaleCode } from '../i18n/types';
import { useLocaleStore } from '../i18n/useLocaleStore';

const LOCALES: Array<{ code: LocaleCode; label: string }> = [
  { code: 'tr', label: 'TR' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs font-mono">
      {LOCALES.map((item) => {
        const active = locale === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code)}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              active
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
