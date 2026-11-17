'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, AuthUser, saveSession } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

type LoginResponse =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired: false; accessToken: string; refreshToken: string; user: AuthUser };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoInfo, setSsoInfo] = useState<{
    enabled: boolean;
    protocol: string;
    providerName: string;
  } | null>(null);

  useEffect(() => {
    apiFetch<{ enabled: boolean; protocol: string; providerName: string }>(
      '/auth/sso/config',
    )
      .then((cfg) => {
        if (cfg.enabled) setSsoInfo(cfg);
      })
      .catch(() => {});
  }, []);

  async function handleSsoLogin() {
    setError(null);
    try {
      const res = await apiFetch<{ authorizeUrl: string }>(
        `/auth/sso/login?redirectUri=${encodeURIComponent(window.location.origin + '/login')}`,
      );
      window.location.href = res.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar SSO');
    }
  }

  function redirectAfterLogin(user: AuthUser) {
    const isStaff = user.roles.some((r) => ['agent', 'manager', 'admin'].includes(r));
    router.push(isStaff ? '/workspace' : '/portal');
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.mfaRequired) {
        setMfaToken(res.mfaToken);
      } else {
        saveSession(res);
        redirectAfterLogin(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      saveSession(res);
      redirectAfterLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código MFA inválido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entrar na Plataforma ITSM</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mfaToken ? 'Informe o código de 6 dígitos do seu autenticador (US-002).' : 'Use sua conta corporativa.'}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!mfaToken ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">E-mail</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Senha</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            {ssoInfo?.enabled && (
              <button
                type="button"
                onClick={handleSsoLogin}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Entrar com {ssoInfo.providerName} ({ssoInfo.protocol})
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleMfa} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300">Código MFA (6 dígitos)</label>
              <input
                required
                pattern="\d{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-lg tracking-widest text-white"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Validando...' : 'Verificar MFA'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
