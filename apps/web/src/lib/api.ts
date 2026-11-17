const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  locale: string;
  roles: string[];
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('itsm_access_token') : null;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Erro HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function saveSession(data: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  localStorage.setItem('itsm_access_token', data.accessToken);
  localStorage.setItem('itsm_refresh_token', data.refreshToken);
  localStorage.setItem('itsm_user', JSON.stringify(data.user));
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('itsm_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('itsm_access_token');
  localStorage.removeItem('itsm_refresh_token');
  localStorage.removeItem('itsm_user');
}
