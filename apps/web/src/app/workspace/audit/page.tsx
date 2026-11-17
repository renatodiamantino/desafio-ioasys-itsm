'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, AuthUser, getStoredUser } from '@/lib/api';
import { useLocale } from '@/components/locale-provider';
import { AppShell } from '@/components/app-shell';

interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (entityType.trim()) params.set('entityType', entityType.trim());
      if (action.trim()) params.set('action', action.trim());

      const res = await apiFetch<AuditLogResponse>(`/audit-logs?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    const canAudit = stored.roles.some((r) => r === 'admin' || r === 'manager');
    if (!canAudit) {
      router.replace('/workspace');
      return;
    }
    setUser(stored);
  }, [router]);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, loadLogs]);

  if (!user) return null;

  return (
    <AppShell
      user={user}
      title={t('audit.title')}
      subtitle="Registro append-only imutável de alterações do sistema"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => {
                setPage(1);
                setEntityType(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todas as entidades</option>
              <option value="organization_settings">organization_settings</option>
              <option value="users">users</option>
              <option value="tasks">tasks</option>
            </select>
            <select
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todas as ações</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGIN_MFA">LOGIN_MFA</option>
              <option value="ASSIGN_ROLES">ASSIGN_ROLES</option>
            </select>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Registro append-only (somente leitura) · {data?.total ?? 0} eventos
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2.5">Data/Hora</th>
                <th className="px-3 py-2.5">Ação</th>
                <th className="px-3 py-2.5">Entidade</th>
                <th className="px-3 py-2.5">Campo</th>
                <th className="px-3 py-2.5">Valor Anterior</th>
                <th className="px-3 py-2.5">Novo Valor</th>
                <th className="px-3 py-2.5">Ator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Carregando logs de auditoria...
                  </td>
                </tr>
              ) : !data?.items.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-sky-600 dark:text-sky-400">
                      {item.action}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {item.entityType}
                      <div className="text-[10px] text-slate-400">{item.entityId}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{item.fieldName || '—'}</td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-slate-500">
                      {formatJson(item.oldValue)}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono">
                      {formatJson(item.newValue)}
                    </td>
                    <td className="px-3 py-2">
                      {item.actor ? `${item.actor.name} (${item.actor.email})` : 'Sistema'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700"
            >
              Anterior
            </button>
            <span>
              Página {data.page} de {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
