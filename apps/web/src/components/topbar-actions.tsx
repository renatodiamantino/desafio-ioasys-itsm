'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, clearSession } from '@/lib/api';
import { ThemeToggle } from './theme-toggle';
import { LocaleSwitcher, useLocale } from './locale-provider';
import { UserAvatar } from './badges';

export function TopbarActions({ user }: { user: AuthUser }) {
  const router = useRouter();
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5 text-xs">
      {/* Perfil do Usuário (Avatar + Nome + Dropdown com Idioma e Sair) */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-2 py-1 text-slate-100 transition hover:bg-white/10"
      >
        <div className="relative">
          <UserAvatar name={user.name} size="sm" />
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#293e40] bg-emerald-400" />
        </div>
        <span className="hidden font-medium sm:inline">{user.name}</span>
        <span className="hidden text-[10px] text-slate-300 sm:inline">▾</span>
      </button>

      {/* Ícone Sol / Lua (Light / Dark Mode) */}
      <ThemeToggle iconOnly />

      {/* Dropdown do Usuário */}
      {menuOpen && (
        <div className="absolute top-10 right-0 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <div className="border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div className="font-bold">{user.name}</div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {user.email}
            </div>
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {user.roles.join(', ')}
            </span>
          </div>

          <div className="my-2.5 space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Idioma / Language
            </label>
            <LocaleSwitcher />
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <span>{t('nav.logout')}</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
