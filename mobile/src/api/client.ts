import { API_BASE_URL } from '../config/api';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

/** NestJS / Express JSON error bodies */
export function messageFromApiBody(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const m = (data as { message?: unknown }).message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length > 0 && m.every((x) => typeof x === 'string')) {
    return m.join(', ');
  }
  return undefined;
}

export type PostJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  networkError?: string;
};

/** Unauthenticated JSON POST (login, register, guest). */
export async function postJson<T>(path: string, body: unknown): Promise<PostJsonResult<T>> {
  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = {} as T;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = {} as T;
      }
    }
    let networkError: string | undefined;
    if (!res.ok && res.status === 404 && typeof text === 'string') {
      const ngrokOffline =
        text.includes('ngrok') && (text.includes('offline') || text.includes('ERR_NGROK'));
      if (ngrokOffline || (API_BASE_URL.includes('ngrok') && !text.trim().startsWith('{'))) {
        networkError =
          `API URL unreachable (404). If you use ngrok, start it: ngrok http 3001 — tunnel must stay running. Current base: ${API_BASE_URL}`;
      }
    }
    return { ok: res.ok, status: res.status, data, networkError };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return {
      ok: false,
      status: 0,
      data: {} as T,
      networkError: `${msg} — is the API running at ${API_BASE_URL}? On a phone set EXPO_PUBLIC_API_URL to your computer's LAN IP.`,
    };
  }
}

export function authedFetch(sessionId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionId}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
