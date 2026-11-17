'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, AuthUser, getStoredUser } from '@/lib/api';
import { useLocale } from '@/components/locale-provider';
import { PriorityBadge, StateBadge, UserAvatar } from '@/components/badges';
import { DonutChart } from '@/components/donut-chart';
import { TopbarActions } from '@/components/topbar-actions';

interface OrganizationInfo {
  companyName: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

interface PortalIncident {
  id: string;
  number: string;
  shortDescription: string;
  description?: string | null;
  state: string;
  priority: number;
  openedAt: string;
  incident?: {
    category?: { id: string; name: string } | null;
    resolutionNotes?: string | null;
  } | null;
}

interface PortalIncidentDetail extends PortalIncident {
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

interface LookupCategory {
  id: string;
  name: string;
}

const KB_SUGGESTIONS = [
  {
    id: 'KB0001',
    title: 'Como redefinir sua senha corporativa ou desbloquear MFA',
    keywords: ['senha', 'password', 'login', 'mfa', 'acesso', 'bloqueio'],
    summary: 'Acesse Configurações de Segurança no Portal ou clique em "Esqueci minha senha" na tela de login.',
  },
  {
    id: 'KB0002',
    title: 'Conectar na VPN corporativa (Windows e macOS)',
    keywords: ['vpn', 'rede', 'remoto', 'acesso', 'internet', 'wifi'],
    summary: 'Abra o cliente VPN, selecione o gateway principal e autentique com seu e-mail corporativo + token MFA.',
  },
  {
    id: 'KB0003',
    title: 'Configurar impressora de rede no andar',
    keywords: ['impressora', 'impresora', 'imprimir', 'scanner', 'papel'],
    summary: 'No Windows, acesse Configurações → Impressoras → Adicionar dispositivo e selecione a fila corporativa.',
  },
  {
    id: 'KB0004',
    title: 'Solicitar novo software ou licença de aplicativo',
    keywords: ['software', 'licença', 'licenca', 'instalar', 'programa', 'office', 'teams'],
    summary: 'Verifique primeiro o Catálogo de Software aprovado antes de abrir um incidente de falha.',
  },
];

export default function PortalPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [categories, setCategories] = useState<LookupCategory[]>([]);
  const [items, setItems] = useState<PortalIncident[]>([]);
  const [search, setSearch] = useState('');
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [selected, setSelected] = useState<PortalIncidentDetail | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    shortDescription: '',
    description: '',
    categoryId: '',
    urgency: 2,
  });

  const loadMyIncidents = useCallback(async (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await apiFetch<{ items: PortalIncident[] }>(`/incidents/my${query}`);
    setItems(res.items);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    setUser(stored);

    apiFetch<{ isConfigured: boolean; organization: OrganizationInfo | null }>('/organization')
      .then((res) => {
        if (res.organization) setOrg(res.organization);
      })
      .catch(() => {});

    apiFetch<{ categories: LookupCategory[] }>('/incidents/catalog/lookups')
      .then((res) => setCategories(res.categories || []))
      .catch(() => {});

    loadMyIncidents().catch((err) =>
      setError(err instanceof Error ? err.message : 'Erro ao carregar chamados'),
    );
  }, [router, loadMyIncidents]);

  const suggestedArticles = useMemo(() => {
    const text = (form.shortDescription || search).trim().toLowerCase();
    if (!text) return KB_SUGGESTIONS.slice(0, 3);
    const matches = KB_SUGGESTIONS.filter(
      (kb) =>
        kb.title.toLowerCase().includes(text) ||
        kb.keywords.some((k) => text.includes(k)),
    );
    return matches.length ? matches : KB_SUGGESTIONS.slice(0, 2);
  }, [form.shortDescription, search]);

  async function openDetail(id: string) {
    try {
      const detail = await apiFetch<PortalIncidentDetail>(`/incidents/${id}`);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes');
    }
  }

  async function handleCreateIncident(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setToast(null);
    try {
      const created = await apiFetch<{ id: string; number: string }>('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          shortDescription: form.shortDescription,
          description: form.description || undefined,
          categoryId: form.categoryId || undefined,
          impact: 3,
          urgency: form.urgency,
          channel: 'PORTAL',
        }),
      });
      setForm({ shortDescription: '', description: '', categoryId: '', urgency: 2 });
      setShowHelpForm(false);
      setToast(`Chamado ${created.number} aberto com sucesso!`);
      await loadMyIncidents(search);
      await openDetail(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir chamado');
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!selected || !commentBody.trim()) return;
    try {
      await apiFetch(`/incidents/${selected.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody, isInternal: false }),
      });
      setCommentBody('');
      await openDetail(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar comentário');
    }
  }

  async function handleReopen() {
    if (!selected) return;
    try {
      await apiFetch(`/incidents/${selected.id}/reopen`, { method: 'POST' });
      setToast(`Chamado ${selected.number} reaberto.`);
      await loadMyIncidents(search);
      await openDetail(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reabrir');
    }
  }

  if (!user) return null;

  const brandColor = org?.primaryColor || '#0F4C81';
  const isStaff = user.roles.some((r) => ['agent', 'manager', 'admin'].includes(r));
  const openCount = items.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.state)).length;
  const resolvedCount = items.filter((i) => i.state === 'RESOLVED').length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Barra Global Padrão ServiceNow (#293e40) */}
      <header className="flex h-12 items-center justify-between border-b border-[#1f2933] bg-[#293e40] px-4 text-white sm:px-6">
        <div className="flex items-center gap-3">
          {org?.logoUrl && (
            <img src={org.logoUrl} alt={org.companyName} className="h-6 w-6 rounded object-contain" />
          )}
          <span className="text-base font-extrabold tracking-tight text-white">
            service<span className="text-emerald-400">itsm</span>
          </span>
          <span className="hidden text-xs font-medium text-slate-300 sm:inline">
            · {org?.companyName ? `${org.companyName} · ${t('nav.portal')}` : t('nav.portal')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {isStaff && (
            <Link
              href="/workspace"
              className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Service Operations Workspace
            </Link>
          )}
          <TopbarActions user={user} />
        </div>
      </header>

      {/* Hero personalizado (US-080, US-084) */}
      <section
        className="border-b border-slate-200 px-6 py-9 text-white dark:border-slate-800"
        style={{ background: `linear-gradient(135deg, #1e293b 0%, ${brandColor} 65%, #0284c7 100%)` }}
      >
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {user.name}. Como podemos ajudar hoje?
          </h1>
          <p className="mt-1 text-sm text-slate-200">
            Pesquise soluções rápidas na base de conhecimento, abra um chamado ou acompanhe suas solicitações.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <div className="relative w-full max-w-xl">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  loadMyIncidents(e.target.value).catch(() => {});
                }}
                placeholder="Buscar nos seus chamados ou na base de conhecimento..."
                className="w-full rounded-lg border-0 bg-white py-2.5 pr-4 pl-9 text-sm text-slate-900 shadow-md focus:outline-none"
              />
              <svg
                className="absolute top-3 left-3 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>
            <button
              onClick={() => setShowHelpForm(true)}
              className="rounded-lg bg-[#278efc] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
            >
              + Preciso de ajuda
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {toast && (
          <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Cartões rápidos + Indicador Donut */}
        <div className="grid gap-4 lg:grid-cols-4">
          <button
            onClick={() => setShowHelpForm(true)}
            className="flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-sky-500 bg-white p-4 text-left shadow-sm transition hover:border-sky-500 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-sky-600 dark:text-sky-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Preciso de ajuda
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Relate uma falha técnica ou indisponibilidade para o Service Desk.
            </p>
            <span className="mt-3 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              Abrir incidente →
            </span>
          </button>

          <div className="flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-indigo-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              Meus chamados ({openCount} abertos)
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Total de {items.length} registros vinculados à sua conta.
            </p>
            <span className="mt-3 text-[11px] font-medium text-slate-400">
              Atualizado em tempo real
            </span>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-amber-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Base de Conhecimento
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {KB_SUGGESTIONS.length} guias rápidos para resolução imediata sem fila.
            </p>
            <span className="mt-3 text-[11px] font-medium text-slate-400">
              Deflexão inteligente ativa
            </span>
          </div>

          <DonutChart
            title={t('portal.myIncidentsOverview')}
            total={items.length}
            slices={[
              { label: t('portal.openTickets'), value: openCount, color: '#38bdf8' },
              { label: t('portal.resolvedTickets'), value: resolvedCount, color: '#10b981' },
            ]}
          />
        </div>

        {/* Formulário com deflexão KB (US-081) */}
        {showHelpForm && (
          <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-3">
            <form onSubmit={handleCreateIncident} className="space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h2 className="text-base font-bold">Abrir Incidente</h2>
                <button
                  type="button"
                  onClick={() => setShowHelpForm(false)}
                  className="text-xs font-medium text-slate-500 hover:underline"
                >
                  {t('common.cancel')}
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold">Resumo do problema *</label>
                <input
                  required
                  minLength={3}
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  placeholder="Ex.: Não consigo conectar na VPN"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold">Categoria</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Urgência</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm({ ...form, urgency: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value={1}>1 - Alta (impede meu trabalho)</option>
                    <option value={2}>2 - Média</option>
                    <option value={3}>3 - Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold">Detalhes adicionais</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#278efc] px-5 py-2 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Enviar Chamado
              </button>
            </form>

            {/* Deflexão por KB (US-081) */}
            <aside className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Artigos Sugeridos
              </div>
              {suggestedArticles.map((kb) => (
                <div
                  key={kb.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="font-semibold">{kb.title}</div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">{kb.summary}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHelpForm(false);
                      setToast(`Ótimo! Que bom que "${kb.title}" resolveu seu problema.`);
                    }}
                    className="mt-2 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    ✓ Isso resolveu meu problema
                  </button>
                </div>
              ))}
            </aside>
          </div>
        )}

        {/* Lista estilo ServiceNow + Detalhes (US-082) */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/70">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Meus Chamados
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {items.length} registros
                </span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nenhum chamado encontrado.
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      className={`w-full p-3.5 text-left transition hover:bg-sky-50/60 dark:hover:bg-slate-800/60 ${
                        selected?.id === item.id ? 'bg-sky-50 dark:bg-sky-950/35' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sky-500/50 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                            i
                          </span>
                          <strong className="font-mono text-xs text-sky-600 underline dark:text-sky-400">
                            {item.number}
                          </strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={item.priority} />
                          <StateBadge state={item.state} />
                        </div>
                      </div>
                      <div className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {item.shortDescription}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {!selected ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                Selecione um chamado ao lado para acompanhar o andamento e conversar com o atendimento.
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                        {selected.number}
                      </span>
                      <PriorityBadge priority={selected.priority} />
                      <StateBadge state={selected.state} />
                    </div>
                    <h3 className="text-base font-bold">{selected.shortDescription}</h3>
                  </div>
                  {selected.state === 'RESOLVED' && (
                    <button
                      onClick={handleReopen}
                      className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                    >
                      Reabrir Chamado
                    </button>
                  )}
                </div>

                {selected.description && (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {selected.description}
                  </p>
                )}

                {selected.incident?.resolutionNotes && (
                  <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>Nota de Resolução:</strong> {selected.incident.resolutionNotes}
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Comentários Públicos
                  </div>
                  {selected.comments.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum comentário ainda.</p>
                  ) : (
                    selected.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                            <UserAvatar name={c.author.name} size="sm" />
                            {c.author.name}
                          </span>
                          <span>{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap pl-8">{c.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <input
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Escreva uma mensagem para o atendimento..."
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#278efc] px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
