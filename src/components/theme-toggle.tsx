'use client';

import { useEffect, useState } from 'react';

const THEME_KEY = 'ev.theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'system') || 'system';
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(mode: 'light' | 'dark' | 'system') {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
      return;
    }
    root.classList.add(mode);
  }

  function toggle() {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
      aria-label="Cambiar tema"
    >
      {theme === 'light' ? '☀️ Claro' : theme === 'dark' ? '🌙 Oscuro' : '🖥️ Sistema'}
    </button>
  );
}
