'use client';

import { useLocale } from './locale-provider';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  total: number;
  slices: DonutSlice[];
  onViewAll?: () => void;
}

export function DonutChart({ title, total, slices, onViewAll }: DonutChartProps) {
  const { t } = useLocale();
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const sum = slices.reduce((acc, s) => acc + s.value, 0);

  let accumulated = 0;
  const segments =
    sum === 0
      ? []
      : slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = s.value / sum;
            const dash = pct * circumference;
            const offset = -accumulated * circumference;
            accumulated += pct;
            return { ...s, dash, offset };
          });

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</span>
        <span className="text-xs text-slate-400">⋮</span>
      </div>

      <div className="my-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="11"
              className="text-slate-100 dark:text-slate-800"
            />
            {segments.map((seg) => (
              <circle
                key={seg.label}
                cx="44"
                cy="44"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="11"
                strokeDasharray={`${seg.dash} ${circumference}`}
                strokeDashoffset={seg.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-extrabold text-slate-800 dark:text-white">
              {total}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-[11px]">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          <span>⌄</span>
          <span>{t('workspace.allRecords')}</span>
        </button>
      )}
    </div>
  );
}
