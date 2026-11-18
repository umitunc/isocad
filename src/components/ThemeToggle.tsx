import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/90 text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5 text-cyan-300" />}
    </button>
  );
};
