import { getApiBaseUrl } from './api';

/**
 * Public HTTPS origin used only for Lemon’s post-checkout redirect (`/payment/app-redirect` on Nest).
 * Set this when `EXPO_PUBLIC_API_URL` is plain HTTP (LAN IP): run `ngrok http 3001` and paste the https origin here.
 *
 * If unset and `EXPO_PUBLIC_API_URL` is already **public HTTPS** (e.g. ngrok to Nest on 3001), that origin is used.
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
