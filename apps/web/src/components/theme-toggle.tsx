'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('itsm_theme');
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('itsm_theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  const sunIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const moonIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/15 hover:text-white"
      >
        {theme === 'light' ? moonIcon : sunIcon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      title="Alternar tema claro/escuro"
    >
      {theme === 'light' ? moonIcon : sunIcon}
      <span>{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
    </button>
  );
}
