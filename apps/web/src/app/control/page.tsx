'use client';

import { useState } from 'react';
import Link from 'next/link';

const PANELS = [
  { id: 'status.html', label: 'Status & Gantt (Jira)' },
  { id: 'banco.html', label: 'Banco de Dados (DER)' },
  { id: 'mapping.html', label: 'Mapa de Governança (n8n)' },
] as const;

type PanelId = (typeof PANELS)[number]['id'];

export default function ControlPage() {
  const [active, setActive] = useState<PanelId>('status.html');

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#1f2933] bg-[#293e40] px-4 text-white">
        <div className="flex items-center gap-3">
          <Link href="/workspace" className="text-base font-extrabold tracking-tight text-white">
            service<span className="text-emerald-400">itsm</span>
          </Link>
          <span className="text-xs text-slate-300">· Central Control</span>
        </div>

        <nav className="flex items-center gap-1.5">
          {PANELS.map((panel) => {
            const isActive = active === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setActive(panel.id)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white'
                }`}
              >
                {panel.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-xs">
          <a
            href={`/control/raw/${active}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-white/25 bg-white/10 px-2.5 py-1 font-medium text-white hover:bg-white/20"
          >
            Abrir em nova aba ↗
          </a>
          <Link
            href="/workspace"
            className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/25"
          >
            Workspace
          </Link>
        </div>
      </header>

      <iframe
        key={active}
        src={`/control/raw/${active}`}
        title={active}
        className="w-full flex-1 border-0 bg-white dark:bg-slate-950"
      />
    </div>
  );
}
