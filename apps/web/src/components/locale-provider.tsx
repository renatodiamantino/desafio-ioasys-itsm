'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  I18nKey,
  SUPPORTED_LOCALES,
  SupportedLocale,
  translate,
} from '@itsm/shared';
import { apiFetch, getStoredUser } from '@/lib/api';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  t: (key: I18nKey) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'pt-BR',
  setLocale: () => {},
  t: (key) => translate('pt-BR', key),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('pt-BR');

  useEffect(() => {
    const stored = localStorage.getItem('itsm_locale');
    const userLocale = getStoredUser()?.locale;
    const initial = stored || userLocale || 'pt-BR';
    if (SUPPORTED_LOCALES.includes(initial as SupportedLocale)) {
      setLocaleState(initial as SupportedLocale);
      document.documentElement.lang = initial;
    }
  }, []);

  function setLocale(next: SupportedLocale) {
    setLocaleState(next);
    localStorage.setItem('itsm_locale', next);
    document.documentElement.lang = next;

    const user = getStoredUser();
    if (user) {
      localStorage.setItem('itsm_user', JSON.stringify({ ...user, locale: next }));
      apiFetch('/auth/me/locale', {
        method: 'PATCH',
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    }
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        t: (key) => translate(locale, key),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <select
      aria-label="Idioma"
      value={locale}
      onChange={(e) => setLocale(e.target.value as SupportedLocale)}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      <option value="pt-BR">🇧🇷 Português (pt-BR)</option>
      <option value="en">🇺🇸 English (en)</option>
      <option value="es">🇪🇸 Español (es)</option>
    </select>
  );
}
