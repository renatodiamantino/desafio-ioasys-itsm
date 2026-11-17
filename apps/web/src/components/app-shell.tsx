'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthUser } from '@/lib/api';
import { useLocale } from './locale-provider';
import { TopbarActions } from './topbar-actions';

interface AppShellProps {
  user: AuthUser;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

interface NavChild {
  label: string;
  href: string;
}

interface NavSection {
  id: string;
  label: string;
  show: boolean;
  children: NavChild[];
}

export function AppShell({ user, title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [navFilter, setNavFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'favorites' | 'history'>('apps');
  const [favorites, setFavorites] = useState<NavChild[]>([]);
  const [history, setHistory] = useState<Array<NavChild & { visitedAt: string }>>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'self-service': true,
    'service-desk': true,
    incident: true,
    administration: true,
  });

  const isAdmin = user.roles.includes('admin');
  const isManagerOrAdmin = user.roles.some((r) => r === 'admin' || r === 'manager');

  const sections: NavSection[] = useMemo(
    () => [
      {
        id: 'self-service',
        label: t('nav.selfService'),
        show: true,
        children: [{ label: t('nav.portal'), href: '/portal' }],
      },
      {
        id: 'service-desk',
        label: t('nav.serviceDesk'),
        show: true,
        children: [
          { label: t('nav.workspace'), href: '/workspace' },
          { label: t('nav.myTickets'), href: '/portal' },
        ],
      },
      {
        id: 'incident',
        label: t('nav.incident'),
        show: true,
        children: [
          { label: t('nav.allIncidents'), href: '/workspace' },
          { label: t('nav.openIncidents'), href: '/workspace?state=IN_PROGRESS' },
          { label: t('nav.resolvedIncidents'), href: '/workspace?state=RESOLVED' },
        ],
      },
      {
        id: 'administration',
        label: t('nav.administration'),
        show: isManagerOrAdmin,
        children: [
          { label: t('nav.audit'), href: '/workspace/audit' },
          ...(isAdmin
            ? [
                { label: t('nav.importCsv'), href: '/workspace/users/import' },
                { label: t('nav.sso'), href: '/workspace/settings/sso' },
                { label: 'Central Control', href: '/control' },
              ]
            : []),
        ],
      },
    ],
    [isAdmin, isManagerOrAdmin, t],
  );

  const filteredSections = useMemo(() => {
    const q = navFilter.trim().toLowerCase();
    return sections
      .filter((s) => s.show)
      .map((s) => ({
        ...s,
        children: q
          ? s.children.filter(
              (c) =>
                c.label.toLowerCase().includes(q) ||
                s.label.toLowerCase().includes(q),
            )
          : s.children,
      }))
      .filter((s) => s.children.length > 0);
  }, [sections, navFilter]);

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    try {
      const rawFav = localStorage.getItem('itsm_nav_favorites');
      if (rawFav) {
        setFavorites(JSON.parse(rawFav));
      } else {
        const defaults: NavChild[] = [
          { label: t('nav.workspace'), href: '/workspace' },
          { label: t('nav.portal'), href: '/portal' },
        ];
        setFavorites(defaults);
        localStorage.setItem('itsm_nav_favorites', JSON.stringify(defaults));
      }
    } catch {}

    try {
      const rawHist = localStorage.getItem('itsm_nav_history');
      const parsed: Array<NavChild & { visitedAt: string }> = rawHist ? JSON.parse(rawHist) : [];
      const entry = {
        label: title || pathname,
        href: pathname,
        visitedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      const next = [entry, ...parsed.filter((h) => h.href !== pathname)].slice(0, 15);
      setHistory(next);
      localStorage.setItem('itsm_nav_history', JSON.stringify(next));
    } catch {}
  }, [pathname, title, t]);

  function toggleFavorite(item: NavChild) {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.href === item.href && f.label === item.label);
      const next = exists
        ? prev.filter((f) => !(f.href === item.href && f.label === item.label))
        : [...prev, item];
      localStorage.setItem('itsm_nav_favorites', JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* ServiceNow Global Top Banner */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f2933] bg-[#293e40] px-4 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Alternar menu lateral"
            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/workspace" className="flex items-baseline gap-2.5">
            <span className="text-lg font-extrabold tracking-tight text-white">
              service<span className="text-emerald-400">itsm</span>
            </span>
            <span className="hidden text-xs font-medium text-slate-300 sm:inline">
              Service Management
            </span>
          </Link>
        </div>

        <TopbarActions user={user} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ServiceNow Left Application Navigator */}
        {sidebarOpen && (
          <aside className="flex w-60 shrink-0 flex-col border-r border-[#232b35] bg-[#303a46] text-slate-200">
            <div className="p-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  placeholder={t('nav.filterNavigator')}
                  className="w-full rounded-full border border-slate-500/60 bg-[#252d37] py-1.5 pr-3 pl-8 text-xs text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none"
                />
                <svg
                  className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </div>
            </div>

            {/* Navigator Icon Tabs */}
            <div className="grid grid-cols-3 border-y border-[#232b35] bg-[#29323d] text-center text-slate-400">
              <button
                type="button"
                onClick={() => setActiveTab('apps')}
                className={`py-2 text-xs font-semibold transition ${
                  activeTab === 'apps'
                    ? 'border-b-2 border-emerald-400 text-white'
                    : 'hover:text-white'
                }`}
                title={t('nav.apps')}
              >
                {t('nav.apps')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`py-2 text-xs transition ${
                  activeTab === 'favorites'
                    ? 'border-b-2 border-emerald-400 text-amber-300'
                    : 'hover:text-white'
                }`}
                title={t('nav.favorites')}
              >
                ★
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-2 text-xs transition ${
                  activeTab === 'history'
                    ? 'border-b-2 border-emerald-400 text-sky-300'
                    : 'hover:text-white'
                }`}
                title={t('nav.history')}
              >
                ◷
              </button>
            </div>

            {/* Accordion Menu / Favorites / History */}
            <nav className="flex-1 overflow-y-auto py-1 text-xs">
              {activeTab === 'apps' &&
                filteredSections.map((sec) => {
                  const isOpen = openSections[sec.id] ?? true;
                  return (
                    <div key={sec.id} className="border-b border-[#262f3a]">
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold text-slate-100 hover:bg-[#3a4654]"
                      >
                        <span>{sec.label}</span>
                        <span className="text-[10px] text-slate-400">{isOpen ? '▾' : '▸'}</span>
                      </button>
                      {isOpen && (
                        <div className="bg-[#27303b] py-1">
                          {sec.children.map((child) => {
                            const active = pathname === child.href;
                            const isFav = favorites.some(
                              (f) => f.href === child.href && f.label === child.label,
                            );
                            return (
                              <div
                                key={`${sec.id}-${child.label}`}
                                className={`group flex items-center justify-between pr-2 transition ${
                                  active
                                    ? 'border-l-2 border-emerald-400 bg-[#1f2730] font-semibold text-white'
                                    : 'text-slate-300 hover:bg-[#323d4a] hover:text-white'
                                }`}
                              >
                                <Link
                                  href={child.href}
                                  className="flex-1 truncate py-1.5 pl-6"
                                >
                                  {child.label}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => toggleFavorite(child)}
                                  title={t('nav.favorites')}
                                  className={`px-1 text-[11px] transition ${
                                    isFav
                                      ? 'text-amber-400'
                                      : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                                  }`}
                                >
                                  {isFav ? '★' : '☆'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {activeTab === 'favorites' && (
                <div className="py-1">
                  {favorites.length === 0 ? (
                    <p className="px-4 py-4 text-[11px] text-slate-400">
                      {t('nav.noFavorites')}
                    </p>
                  ) : (
                    favorites
                      .filter((f) =>
                        !navFilter.trim() ||
                        f.label.toLowerCase().includes(navFilter.trim().toLowerCase()),
                      )
                      .map((fav) => (
                        <div
                          key={`${fav.href}-${fav.label}`}
                          className="flex items-center justify-between px-3 py-1.5 text-slate-200 hover:bg-[#323d4a]"
                        >
                          <Link href={fav.href} className="flex-1 truncate">
                            ★ {fav.label}
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(fav)}
                            className="px-1 text-[11px] text-amber-400 hover:text-rose-400"
                            title="Remover favorito"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="py-1">
                  {history.length === 0 ? (
                    <p className="px-4 py-4 text-[11px] text-slate-400">
                      {t('nav.noHistory')}
                    </p>
                  ) : (
                    history
                      .filter((h) =>
                        !navFilter.trim() ||
                        h.label.toLowerCase().includes(navFilter.trim().toLowerCase()),
                      )
                      .map((item) => (
                        <Link
                          key={`${item.href}-${item.visitedAt}`}
                          href={item.href}
                          className="flex items-center justify-between px-3 py-2 text-slate-300 hover:bg-[#323d4a] hover:text-white"
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="ml-2 shrink-0 text-[10px] text-slate-400">
                            {item.visitedAt}
                          </span>
                        </Link>
                      ))
                  )}
                </div>
              )}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
              )}
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {user.roles.join(', ')}
            </span>
          </div>
          <main className="flex-1 p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
