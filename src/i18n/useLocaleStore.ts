import { create } from 'zustand';
import { en } from './en';
import { ru } from './ru';
import { tr } from './tr';
import { LocaleCode, TranslationDict } from './types';

const DICTS: Record<LocaleCode, TranslationDict> = { tr, en, ru };

function applySeoMeta(loc: LocaleCode, dict: TranslationDict): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = loc;
  document.title = dict.meta.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', dict.meta.description);
  }
}

interface LocaleState {
  locale: LocaleCode;
  t: TranslationDict;
  setLocale: (loc: LocaleCode) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'tr',
  t: tr,
  setLocale: (loc) => {
    const dict = DICTS[loc];
    applySeoMeta(loc, dict);
    set({ locale: loc, t: dict });
  },
}));
