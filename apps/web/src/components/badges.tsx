'use client';

import type { I18nKey } from '@itsm/shared';
import { useLocale } from './locale-provider';

const PRIORITY_STYLES: Record<number, { label: string; cls: string }> = {
  1: {
    label: 'P1 · Crítica',
    cls: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
  2: {
    label: 'P2 · Alta',
    cls: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  3: {
    label: 'P3 · Média',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  4: {
    label: 'P4 · Baixa',
    cls: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
  5: {
    label: 'P5 · Planejada',
    cls: 'border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
};

const STATE_STYLES: Record<string, { dot: string; cls: string }> = {
  NEW: {
    dot: 'bg-sky-500',
    cls: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  IN_PROGRESS: {
    dot: 'bg-indigo-500',
    cls: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  ON_HOLD: {
    dot: 'bg-amber-500',
    cls: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  RESOLVED: {
    dot: 'bg-emerald-500',
    cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  CLOSED: {
    dot: 'bg-slate-400',
    cls: 'border-slate-400/25 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
  CANCELLED: {
    dot: 'bg-rose-400',
    cls: 'border-rose-400/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
};

export function PriorityBadge({ priority }: { priority: number }) {
  const { t } = useLocale();
  const safePriority = priority >= 1 && priority <= 5 ? priority : 4;
  const cfg = PRIORITY_STYLES[safePriority] ?? PRIORITY_STYLES[4];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}
    >
      {t(`priority.${safePriority}` as I18nKey)}
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  const { t } = useLocale();
  const cfg = STATE_STYLES[state] ?? STATE_STYLES.NEW;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {t(`state.${state}` as I18nKey)}
    </span>
  );
}

export function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white shadow-sm`}
    >
      {initials || '?'}
    </span>
  );
}
