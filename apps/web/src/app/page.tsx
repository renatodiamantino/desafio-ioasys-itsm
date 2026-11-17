'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getStoredUser } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const status = await apiFetch<{ isConfigured: boolean }>('/organization');
        if (!status.isConfigured) {
          router.replace('/setup');
          return;
        }
        const user = getStoredUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        const isStaff = user.roles.some((r) =>
          ['agent', 'manager', 'admin'].includes(r),
        );
        router.replace(isStaff ? '/workspace' : '/portal');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível conectar à API em localhost:3001.',
        );
      }
    }
    init();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
        <h1 className="text-lg font-semibold text-sky-400">ITSM Platform</h1>
        {error ? (
          <div className="mt-4 space-y-2 text-sm text-amber-300">
            <p>{error}</p>
            <p className="text-slate-400">
              Verifique se a API e o PostgreSQL estão rodando.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Carregando instância...</p>
        )}
      </div>
    </main>
  );
}
