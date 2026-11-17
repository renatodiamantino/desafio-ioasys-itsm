'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePriority } from '@itsm/shared';
import { apiFetch, AuthUser, getStoredUser } from '@/lib/api';
import { useLocale } from '@/components/locale-provider';
import { AppShell } from '@/components/app-shell';
import { PriorityBadge, StateBadge, UserAvatar } from '@/components/badges';
import { DonutChart } from '@/components/donut-chart';

interface LookupItem {
  id: string;
  name: string;
  email?: string;
}

interface Lookups {
  categories: LookupItem[];
  resolutionCodes: LookupItem[];
  holdReasons: LookupItem[];
  groups: LookupItem[];
  users: LookupItem[];
}

interface IncidentSummary {
  total: number;
  unassigned: number;
  inProgress: number;
  resolved: number;
}

interface IncidentItem {
  id: string;
  number: string;
  shortDescription: string;
  description?: string | null;
  state: string;
  impact: number;
  urgency: number;
  priority: number;
  openedAt: string;
  requester?: { id: string; name: string; email: string } | null;
  assignedGroup?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  incident?: {
    channel: string;
    category?: { id: string; name: string } | null;
    holdReason?: { id: string; name: string } | null;
    resolutionCode?: { id: string; name: string } | null;
    resolutionNotes?: string | null;
  } | null;
}

interface IncidentDetail extends IncidentItem {
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { name: string };
  }[];
  timeline: {
    id: string;
    action: string;
    createdAt: string;
    actor?: { name: string } | null;
  }[];
}

const STATE_LABELS: Record<string, string> = {
  NEW: 'Novo',
  IN_PROGRESS: 'Em Andamento',
  ON_HOLD: 'Em Espera',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

export default function WorkspacePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [summary, setSummary] = useState<IncidentSummary>({
    total: 0,
    unassigned: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selected, setSelected] = useState<IncidentDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'communicate' | 'timeline'>('overview');
  const [error, setError] = useState<string | null>(null);

  // Novo incidente form
  const [newForm, setNewForm] = useState({
    shortDescription: '',
    description: '',
    categoryId: '',
    impact: 3,
    urgency: 3,
    assignedGroupId: '',
  });

  // Comentário / Nota
  const [commentBody, setCommentBody] = useState('');
  const [commentInternal, setCommentInternal] = useState(true);

  // Resolver modal
  const [showResolve, setShowResolve] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolutionCodeId: '', resolutionNotes: '' });

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set('state', stateFilter);
      if (search.trim()) params.set('q', search.trim());
      const [listRes, lookupRes] = await Promise.all([
        apiFetch<{ items: IncidentItem[]; summary: IncidentSummary }>(
          `/incidents?${params.toString()}`,
        ),
        apiFetch<Lookups>('/incidents/catalog/lookups'),
      ]);
      setIncidents(listRes.items);
      setSummary(listRes.summary);
      setLookups(lookupRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar incidentes');
    }
  }, [search, stateFilter]);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    const isStaff = stored.roles.some((r) => ['agent', 'manager', 'admin'].includes(r));
    if (!isStaff) {
      router.replace('/portal');
      return;
    }
    setUser(stored);
    loadData();
  }, [router, loadData]);

  async function openDetail(id: string) {
    const detail = await apiFetch<IncidentDetail>(`/incidents/${id}`);
    setSelected(detail);
    setActiveTab('overview');
  }

  async function handleCreateIncident(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiFetch<IncidentItem>('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          shortDescription: newForm.shortDescription,
          description: newForm.description || undefined,
          categoryId: newForm.categoryId || undefined,
          impact: Number(newForm.impact),
          urgency: Number(newForm.urgency),
          assignedGroupId: newForm.assignedGroupId || undefined,
        }),
      });
      setShowNewModal(false);
      setNewForm({
        shortDescription: '',
        description: '',
        categoryId: '',
        impact: 3,
        urgency: 3,
        assignedGroupId: '',
      });
      await loadData();
      await openDetail(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar incidente');
    }
  }

  async function handleUpdateState(nextState: string) {
    if (!selected) return;
    if (nextState === 'RESOLVED') {
      setShowResolve(true);
      return;
    }
    try {
      await apiFetch(`/incidents/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          state: nextState,
          holdReasonId:
            nextState === 'ON_HOLD' ? lookups?.holdReasons[0]?.id : undefined,
        }),
      });
      await loadData();
      await openDetail(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar estado');
    }
  }

  async function handleAssignToMe() {
    if (!selected || !user) return;
    await apiFetch(`/incidents/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedToId: user.id, state: 'IN_PROGRESS' }),
    });
    await loadData();
    await openDetail(selected.id);
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!selected || !commentBody.trim()) return;
    await apiFetch(`/incidents/${selected.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: commentBody, isInternal: commentInternal }),
    });
    setCommentBody('');
    await openDetail(selected.id);
  }

  async function handleResolve(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await apiFetch(`/incidents/${selected.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolveForm),
    });
    setShowResolve(false);
    setResolveForm({ resolutionCodeId: '', resolutionNotes: '' });
    await loadData();
    await openDetail(selected.id);
  }

  if (!user) return null;

  return (
    <AppShell
      user={user}
      title={t('nav.workspace')}
      subtitle={t('workspace.subtitle')}
    >
      <div className="mx-auto max-w-7xl">
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Important Actions (ServiceNow Workspace) */}
        {(() => {
          const urgent = incidents.filter(
            (i) => (i.priority <= 2 || !i.assignedTo) && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.state),
          );
          if (urgent.length === 0) return null;
          return (
            <section className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {t('workspace.importantActions')}
                </h2>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {urgent.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {urgent.slice(0, 4).map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => openDetail(inc.id)}
                    className={`flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 ${
                      inc.priority <= 2 ? 'border-l-rose-500' : 'border-l-amber-500'
                    } bg-white p-3.5 text-left shadow-sm transition hover:border-sky-500 dark:border-slate-800 dark:bg-slate-900`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                          {inc.number}
                        </span>
                        <PriorityBadge priority={inc.priority} />
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                        {inc.shortDescription}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800">
                      <span className="truncate">
                        {inc.assignedTo?.name || t('workspace.unassignedLabel')}
                      </span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        {t('workspace.openAction')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Overview — Indicadores Donut (ServiceNow Workspace) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {t('workspace.overview')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DonutChart
              title={t('workspace.incidentsByState')}
              total={summary.total}
              slices={[
                { label: t('state.NEW'), value: incidents.filter((i) => i.state === 'NEW').length, color: '#38bdf8' },
                { label: t('state.IN_PROGRESS'), value: summary.inProgress, color: '#6366f1' },
                { label: t('state.ON_HOLD'), value: incidents.filter((i) => i.state === 'ON_HOLD').length, color: '#f59e0b' },
                { label: t('state.RESOLVED'), value: summary.resolved, color: '#10b981' },
              ]}
              onViewAll={() => setStateFilter('')}
            />
            <DonutChart
              title={t('workspace.incidentsByPriority')}
              total={incidents.length}
              slices={[
                { label: t('priority.1'), value: incidents.filter((i) => i.priority === 1).length, color: '#ef4444' },
                { label: t('priority.2'), value: incidents.filter((i) => i.priority === 2).length, color: '#f97316' },
                { label: t('priority.3'), value: incidents.filter((i) => i.priority === 3).length, color: '#eab308' },
                { label: t('priority.4'), value: incidents.filter((i) => i.priority >= 4).length, color: '#06b6d4' },
              ]}
              onViewAll={() => setStateFilter('')}
            />
            <DonutChart
              title={t('workspace.queueAssignment')}
              total={summary.unassigned}
              slices={[
                { label: t('workspace.unassigned'), value: summary.unassigned, color: '#f59e0b' },
                { label: t('workspace.assigned'), value: Math.max(0, summary.total - summary.unassigned), color: '#3b82f6' },
              ]}
              onViewAll={() => setStateFilter('NEW')}
            />
            <DonutChart
              title={t('workspace.resolutionProgress')}
              total={summary.resolved}
              slices={[
                { label: t('workspace.resolved'), value: summary.resolved, color: '#10b981' },
                { label: t('workspace.active'), value: Math.max(0, summary.total - summary.resolved), color: '#8b5cf6' },
              ]}
              onViewAll={() => setStateFilter('RESOLVED')}
            />
          </div>
        </section>

        {/* ServiceNow List Toolbar */}
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t('list.incidents')}
              </span>
              <button
                onClick={() => setShowNewModal(true)}
                className="rounded bg-[#278efc] px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
              >
                {t('list.new')}
              </button>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t('list.goTo')}</span>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('list.allStates')}</option>
                {Object.entries(STATE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('list.searchPlaceholder')}
                className="w-56 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {incidents.length === 0 ? '0 / 0' : `1 – ${incidents.length} / ${incidents.length}`}
            </div>
          </div>

          {/* Breadcrumb filter bar */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-slate-400">▽</span>
            <button
              type="button"
              onClick={() => {
                setStateFilter('');
                setSearch('');
              }}
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              {t('list.all')}
            </button>
            {stateFilter && (
              <>
                <span className="text-slate-400">&gt;</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t('list.state')} = {STATE_LABELS[stateFilter] || stateFilter}
                </span>
              </>
            )}
            {search && (
              <>
                <span className="text-slate-400">&gt;</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  &quot;{search}&quot;
                </span>
              </>
            )}
          </div>
        </div>

        {/* Lista + Detalhe lado a lado */}
        <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className={selected ? 'lg:col-span-6' : 'lg:col-span-12'}>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5">≡ {t('list.number')} ▲</th>
                    <th className="px-3 py-2.5">≡ {t('list.shortDescription')}</th>
                    <th className="px-3 py-2.5">≡ {t('list.priority')}</th>
                    <th className="px-3 py-2.5">≡ {t('list.state')}</th>
                    <th className="px-3 py-2.5">≡ {t('list.assignedTo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                        {t('list.empty')}
                      </td>
                    </tr>
                  ) : (
                    incidents.map((inc) => (
                      <tr
                        key={inc.id}
                        onClick={() => openDetail(inc.id)}
                        className={`cursor-pointer transition hover:bg-sky-50/50 dark:hover:bg-slate-800/50 ${
                          selected?.id === inc.id ? 'bg-sky-50 dark:bg-sky-950/35' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <span
                            title="Abrir detalhes"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-500/50 text-[10px] font-bold text-sky-600 dark:text-sky-400"
                          >
                            i
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-sky-600 underline dark:text-sky-400">
                          {inc.number}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                          {inc.shortDescription}
                        </td>
                        <td className="px-3 py-2.5">
                          <PriorityBadge priority={inc.priority} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StateBadge state={inc.state} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {inc.assignedTo ? (
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar name={inc.assignedTo.name} size="sm" />
                              <span className="text-xs font-medium text-sky-700 underline dark:text-sky-300">
                                {inc.assignedTo.name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">{t('list.emptyCell')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                      {selected.number} · P{selected.priority}
                    </span>
                    <h2 className="text-lg font-bold">{selected.shortDescription}</h2>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  >
                    Fechar
                  </button>
                </div>

                {/* Ações rápidas */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleAssignToMe}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Atribuir a mim
                  </button>
                  <select
                    value={selected.state}
                    onChange={(e) => handleUpdateState(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {Object.entries(STATE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {selected.state !== 'RESOLVED' && selected.state !== 'CLOSED' && (
                    <button
                      onClick={() => setShowResolve(true)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Resolver Incidente
                    </button>
                  )}
                </div>

                {/* Abas estilo SOW */}
                <div className="mt-4 flex gap-4 border-b border-slate-200 text-xs font-semibold dark:border-slate-800">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'communicate', label: `Communicate (${selected.comments.length})` },
                    { id: 'timeline', label: 'Timeline' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`pb-2 ${
                        activeTab === t.id
                          ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className="mt-4 space-y-3 text-sm">
                    <p className="text-slate-600 dark:text-slate-300">
                      {selected.description || 'Sem descrição adicional.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                      <div>
                        <strong>Solicitante:</strong> {selected.requester?.name}
                      </div>
                      <div>
                        <strong>Categoria:</strong> {selected.incident?.category?.name || '-'}
                      </div>
                      <div>
                        <strong>Grupo:</strong> {selected.assignedGroup?.name || '-'}
                      </div>
                      <div>
                        <strong>Responsável:</strong> {selected.assignedTo?.name || '-'}
                      </div>
                    </div>
                    {selected.incident?.resolutionNotes && (
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <strong>Resolução ({selected.incident.resolutionCode?.name}):</strong>{' '}
                        {selected.incident.resolutionNotes}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'communicate' && (
                  <div className="mt-4 space-y-4">
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="checkbox"
                            checked={commentInternal}
                            onChange={(e) => setCommentInternal(e.target.checked)}
                          />
                          Nota de trabalho (interna — não visível ao usuário)
                        </label>
                      </div>
                      <textarea
                        required
                        rows={3}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder={
                          commentInternal
                            ? 'Adicionar nota interna para a equipe...'
                            : 'Adicionar comentário público para o solicitante...'
                        }
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        Enviar
                      </button>
                    </form>

                    <div className="space-y-2">
                      {selected.comments.map((c) => (
                        <div
                          key={c.id}
                          className={`rounded-lg border p-3 text-xs ${
                            c.isInternal
                              ? 'border-amber-300 bg-amber-50 dark:border-amber-600/40 dark:bg-amber-950/30'
                              : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex justify-between font-semibold">
                            <span>
                              {c.author.name}{' '}
                              {c.isInternal ? '(Nota Interna)' : '(Comentário Público)'}
                            </span>
                            <span className="text-slate-400">
                              {new Date(c.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="mt-4 space-y-2 text-xs">
                    {selected.timeline.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between border-b border-slate-200 py-2 dark:border-slate-800"
                      >
                        <span>
                          <strong>{t.action}</strong> por {t.actor?.name || 'Sistema'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(t.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Incidente */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateIncident}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-bold">Registrar Incidente (US-020)</h2>
            <div>
              <label className="block text-xs font-medium">Título resumido</label>
              <input
                required
                minLength={3}
                value={newForm.shortDescription}
                onChange={(e) => setNewForm({ ...newForm, shortDescription: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Descrição</label>
              <textarea
                rows={3}
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium">Impacto</label>
                <select
                  value={newForm.impact}
                  onChange={(e) => setNewForm({ ...newForm, impact: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={1}>1 - Alto</option>
                  <option value={2}>2 - Médio</option>
                  <option value={3}>3 - Baixo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Urgência</label>
                <select
                  value={newForm.urgency}
                  onChange={(e) => setNewForm({ ...newForm, urgency: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={1}>1 - Alta</option>
                  <option value={2}>2 - Média</option>
                  <option value={3}>3 - Baixa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Prioridade (Auto)</label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-center text-sm font-bold dark:border-slate-700 dark:bg-slate-800">
                  P{calculatePriority(newForm.impact, newForm.urgency)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium">Categoria</label>
                <select
                  value={newForm.categoryId}
                  onChange={(e) => setNewForm({ ...newForm, categoryId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Selecione...</option>
                  {lookups?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Grupo</label>
                <select
                  value={newForm.assignedGroupId}
                  onChange={(e) => setNewForm({ ...newForm, assignedGroupId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Não atribuído</option>
                  {lookups?.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Criar Incidente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Resolver */}
      {showResolve && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleResolve}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-bold">Resolver {selected.number} (US-028)</h2>
            <div>
              <label className="block text-xs font-medium">Código de Resolução</label>
              <select
                required
                value={resolveForm.resolutionCodeId}
                onChange={(e) =>
                  setResolveForm({ ...resolveForm, resolutionCodeId: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Selecione...</option>
                {lookups?.resolutionCodes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium">Nota de Resolução</label>
              <textarea
                required
                minLength={3}
                rows={3}
                value={resolveForm.resolutionNotes}
                onChange={(e) =>
                  setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResolve(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Confirmar Resolução
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
