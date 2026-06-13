import { API_BASE_URL, ngrokFetchHeaders } from '../config/api';

const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Wake Render / cold API before OAuth (free tier can take several seconds). */
export async function wakeApiHealth(): Promise<boolean> {
  for (let attempt = 0; attempt < API_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(apiUrl('/health'), { headers: ngrokFetchHeaders() });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    if (attempt < API_RETRY_ATTEMPTS - 1) {
      await sleep(API_RETRY_DELAY_MS);
    }
  }
  return false;
}

/** Unauthenticated JSON POST (login, register, guest). Retries on network failure. */
export async function postJson<T>(path: string, body: unknown): Promise<PostJsonResult<T>> {
  let lastNetworkError: string | undefined;
  for (let attempt = 0; attempt < API_RETRY_ATTEMPTS; attempt++) {
    const result = await postJsonOnce<T>(path, body);
    if (!result.networkError) return result;
    lastNetworkError = result.networkError;
    if (attempt < API_RETRY_ATTEMPTS - 1) {
      await sleep(API_RETRY_DELAY_MS);
    }
  }
  return {
    ok: false,
    status: 0,
    data: {} as T,
    networkError: lastNetworkError,
  };
}

async function postJsonOnce<T>(path: string, body: unknown): Promise<PostJsonResult<T>> {
  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: {
        ...ngrokFetchHeaders(),
        'Content-Type': 'application/json',
      },
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
      networkError: `${msg} — is the API running at ${API_BASE_URL}? If this is an old ngrok URL, run \`ngrok http 3001\` and update EXPO_PUBLIC_API_URL, or use your PC's LAN IP (e.g. http://192.168.x.x:3001).`,
    };
  }
}

export function authedFetch(sessionId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionId}`);
  }
  for (const [k, v] of Object.entries(ngrokFetchHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
