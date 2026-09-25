import type { ApiError, AuthResponse } from '@nestchat/contracts';
import { useAuthStore } from '../state/auth-store';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Преобразует относительный адрес API-ресурса в абсолютный.
 *
 * @param source - Относительный или абсолютный адрес ресурса.
 * @returns Адрес, пригодный для использования в браузере.
 */
export function resolveApiAssetUrl(source: string): string {
  return source.startsWith('/') ? `${API_URL}/api${source}` : source;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: ApiError,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

async function request<T>(path: string, init: RequestInit, retryAfterRefresh: boolean): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && retryAfterRefresh && !path.startsWith('/auth/')) {
    const auth = await refreshSession();
    if (auth) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new ApiRequestError(payload?.message ?? 'Не удалось выполнить запрос', response.status, payload);
  }
  return response.json() as Promise<T>;
}

export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export async function refreshSession(): Promise<AuthResponse | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Не удалось обновить сессию');
      const auth = (await response.json()) as AuthResponse;
      useAuthStore.getState().setAuth(auth);
      return auth;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
