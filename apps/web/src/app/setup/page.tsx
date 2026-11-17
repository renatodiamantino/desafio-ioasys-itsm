'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: '',
    supportEmail: '',
    defaultTimezone: 'America/Sao_Paulo',
    defaultLocale: 'pt-BR',
    primaryColor: '#0F4C81',
    logoUrl: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/organization/setup', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao configurar instância');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white">Setup Inicial da Empresa (US-001)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure os dados da organização e crie o primeiro usuário administrador.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Nome da Empresa</label>
              <input
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                placeholder="Minha Empresa S.A."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">E-mail do Suporte</label>
              <input
                required
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                placeholder="suporte@empresa.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">Fuso Horário</label>
              <input
                value={form.defaultTimezone}
                onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Idioma Padrão</label>
              <select
                value={form.defaultLocale}
                onChange={(e) => setForm({ ...form, defaultLocale: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="pt-BR">pt-BR</option>
                <option value="en">en</option>
                <option value="es">es</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Cor da Marca</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 p-1"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Nome do Administrador</label>
              <input
                required
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">E-mail do Administrador</label>
              <input
                required
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Senha do Administrador (mín. 8 caracteres)</label>
            <input
              required
              minLength={8}
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? 'Configurando...' : 'Concluir Setup e Ir para Login'}
          </button>
        </form>
      </div>
    </main>
  );
}
