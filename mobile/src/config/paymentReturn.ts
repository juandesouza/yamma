import { getApiBaseUrl } from './api';

/**
 * Public origin of the **Next.js** app (must serve `/payment/app-redirect`), if you use a
 * separate tunnel from the API.
 *
 * If unset and `EXPO_PUBLIC_API_URL` is **public HTTPS** (e.g. ngrok to Nest on 3001), the same
 * origin is used — the API serves `/payment/app-redirect` so one tunnel is enough.
 */
export function getPaymentReturnBaseUrl(): string | undefined {
  const v = process.env.EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL?.trim().replace(/\/$/, '');
  return v || undefined;
}

/** Origin sent to `POST /payments/create` for Lemon’s mobile return URL. */
export function getMobileLemonReturnBaseUrl(): string | undefined {
  const explicit = getPaymentReturnBaseUrl();
  if (explicit) return explicit;
  try {
    const u = new URL(getApiBaseUrl());
    if (u.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) {
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}
