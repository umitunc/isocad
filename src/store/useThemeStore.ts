import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'qcad_theme_v1';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyThemeToDom(theme: ThemeMode): void {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

const initial = getInitialTheme();
if (typeof document !== 'undefined') {
  applyThemeToDom(initial);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggleTheme: () =>
    set((s) => {
      const next: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // ignore
      }
      applyThemeToDom(next);
      return { theme: next };
    }),
  setTheme: (t) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // ignore
    }
    applyThemeToDom(t);
    set({ theme: t });
  },
}));
