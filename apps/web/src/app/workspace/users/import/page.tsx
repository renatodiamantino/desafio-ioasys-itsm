'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, AuthUser, getStoredUser } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface ImportReport {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; email: string; error: string }[];
}

export default function UsersImportPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csvContent, setCsvContent] = useState(
    'email,name,jobTitle,phone,groups\nana@empresa.com,Ana Souza,Analista N1,+55 11 99999-0001,Service Desk|N1',
  );
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (!stored.roles.includes('admin')) {
      router.replace('/workspace');
      return;
    }
    setUser(stored);
  }, [router]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvContent(text);
  }

  async function runImport(dryRun: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ImportReport>('/users/import/csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, dryRun }),
      });
      setReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar CSV');
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <AppShell
      user={user}
      title="Importação de Usuários & Grupos (US-004)"
      subtitle="Upload CSV com pré-visualização (Dry-Run) e provisionamento SCIM 2.0"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-base font-semibold">Importação via CSV</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Colunas obrigatórias: <code>email</code>, <code>name</code>. Opcionais:{' '}
            <code>jobTitle</code>, <code>phone</code>, <code>groups</code> (separados por{' '}
            <code>|</code>).
          </p>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="mb-3 block text-xs"
          />

          <textarea
            rows={7}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={loading}
              onClick={() => runImport(true)}
              className="rounded-lg border border-sky-600 px-4 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-950"
            >
              Pré-visualizar (Dry-Run)
            </button>
            <button
              disabled={loading}
              onClick={() => runImport(false)}
              className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Importar Usuários
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {report && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-bold">
              {report.dryRun ? 'Pré-visualização (Dry-Run)' : 'Resultado da Importação'}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                <div className="text-slate-500">Linhas</div>
                <div className="text-lg font-bold">{report.totalRows}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <div>Criados</div>
                <div className="text-lg font-bold">{report.created}</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                <div>Atualizados</div>
                <div className="text-lg font-bold">{report.updated}</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <div>Erros</div>
                <div className="text-lg font-bold">{report.skipped}</div>
              </div>
            </div>

            {report.errors.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-1.5">Linha</th>
                      <th className="py-1.5">E-mail</th>
                      <th className="py-1.5">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.map((err, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-1.5 font-mono">{err.line}</td>
                        <td className="py-1.5 font-mono">{err.email || '—'}</td>
                        <td className="py-1.5 text-red-600 dark:text-red-400">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
