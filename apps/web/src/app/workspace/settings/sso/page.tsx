'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, AuthUser, getStoredUser } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface SsoAdminConfig {
  enabled: boolean;
  protocol: 'OIDC' | 'SAML';
  providerName: string;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  metadataXml: string;
  jitProvisioning: boolean;
}

export default function SsoSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<SsoAdminConfig & { clientSecret: string }>({
    enabled: false,
    protocol: 'OIDC',
    providerName: 'SSO Corporativo',
    issuerUrl: '',
    clientId: '',
    clientSecret: '',
    hasClientSecret: false,
    metadataXml: '',
    jitProvisioning: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

    apiFetch<SsoAdminConfig>('/auth/sso/admin-config')
      .then((cfg) => setForm((prev) => ({ ...prev, ...cfg, clientSecret: '' })))
      .catch(() => {});
  }, [router]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await apiFetch<SsoAdminConfig>('/auth/sso/config', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: form.enabled,
          protocol: form.protocol,
          providerName: form.providerName,
          issuerUrl: form.issuerUrl,
          clientId: form.clientId,
          clientSecret: form.clientSecret || undefined,
          metadataXml: form.metadataXml,
          jitProvisioning: form.jitProvisioning,
        }),
      });
      setForm((prev) => ({ ...prev, ...saved, clientSecret: '' }));
      setMessage('Configuração de SSO salva e auditada com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar SSO');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <AppShell
      user={user}
      title="Configuração de SSO Corporativo (US-003)"
      subtitle="Autenticação OIDC / SAML 2.0 e Just-In-Time Provisioning"
    >
      <div className="mx-auto max-w-3xl">
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {message && (
            <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-400/50 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Ativar SSO Corporativo</label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium">Protocolo</label>
              <select
                value={form.protocol}
                onChange={(e) =>
                  setForm({ ...form, protocol: e.target.value as 'OIDC' | 'SAML' })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="OIDC">OIDC (Azure AD / Google / Okta)</option>
                <option value="SAML">SAML 2.0</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium">Nome do Provedor</label>
              <input
                type="text"
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium">Issuer URL</label>
            <input
              type="url"
              placeholder="https://login.microsoftonline.com/<tenant>/v2.0"
              value={form.issuerUrl}
              onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium">Client ID</label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">
                Client Secret {form.hasClientSecret ? '(já configurado)' : ''}
              </label>
              <input
                type="password"
                placeholder={form.hasClientSecret ? '••••••••' : 'Informe o secret'}
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {form.protocol === 'SAML' && (
            <div>
              <label className="block text-xs font-medium">Metadata XML (SAML)</label>
              <textarea
                rows={4}
                value={form.metadataXml}
                onChange={(e) => setForm({ ...form, metadataXml: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Just-In-Time Provisioning (criar usuário automaticamente no 1º login)
            </span>
            <input
              type="checkbox"
              checked={form.jitProvisioning}
              onChange={(e) => setForm({ ...form, jitProvisioning: e.target.checked })}
              className="h-4 w-4"
            />
          </div>

          <button
            disabled={saving}
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Configuração SSO'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
