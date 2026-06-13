import type { Response } from 'express';

const APP_SCHEME = 'yamma';
const DEFAULT_APP_RETURN = `${APP_SCHEME}://oauthredirect`;

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function parseAppResumeTarget(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  let t = value.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== 'exp:' && u.protocol !== 'yamma:' && u.protocol !== 'expo:') return null;
    return t;
  } catch {
    return null;
  }
}

/** OAuth `state` from mobile packs the Expo / dev-client return URL (`exp://…` or `yamma://…`). */
export function unpackGoogleMobileOAuthState(state: string | undefined): string | null {
  if (!state?.trim()) return null;
  const raw = state.trim();
  let json: string | null = null;
  try {
    json = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    try {
      const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
      json = Buffer.from(padded, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(json) as { r?: string };
    if (typeof parsed.r === 'string') {
      return parseAppResumeTarget(parsed.r);
    }
  } catch {
    /* legacy plain state from expo-auth-session */
  }
  return null;
}

export function appendQueryToDeepLink(
  base: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    params.set(key, Array.isArray(value) ? value[0] : String(value));
  }
  const qs = params.toString();
  if (!qs) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}

/** Final OAuth callback page — URL keeps query params for promptAsync (no further redirects). */
export function sendGoogleOAuthCallbackHtml(res: Response, message = 'Returning to Yamma…') {
  const safe = escapeHtmlAttr(message);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Signed in with Google</p><p style="margin:0;font-size:14px;opacity:.75">${safe}</p><script>try{window.close();}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

export function sendGoogleOAuthErrorHtml(res: Response, errorMessage: string) {
  const safe = escapeHtmlAttr(errorMessage.slice(0, 300));
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Google sign-in failed</p><p style="margin:0;font-size:14px;opacity:.75">${safe}</p></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

/** Static page openAuthSessionAsync lands on after server-side OAuth exchange. */
export function sendGoogleOAuthMobileDoneHtml(res: Response) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Signed in with Google</p><p style="margin:0;font-size:14px;opacity:.75">Returning to Yamma…</p><script>try{window.close();}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

/** Opens the app via custom scheme (same pattern as payment return bridge). */
export function sendAppResumeHtml(res: Response, target: string) {
  const href = escapeHtmlAttr(target);
  const js = JSON.stringify(target);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="refresh" content="0;url=${href}"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Signed in with Google</p><p style="margin:0;font-size:14px;opacity:.75">Returning to Yamma…</p><p style="margin-top:20px"><a href="${href}" style="color:#ff9a66;font-weight:600;font-size:16px">Open in app</a></p><script>try{location.replace(${js});}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

export function resolveGoogleOAuthAppReturnTarget(
  state: string | undefined,
  query: Record<string, string | string[] | undefined>,
): string {
  const fromState = unpackGoogleMobileOAuthState(state);
  const base = fromState ?? DEFAULT_APP_RETURN;
  return appendQueryToDeepLink(base, query);
}

/** Shown while openAuthSessionAsync captures `?code=` from the redirect URL. */
export function sendGoogleOAuthBridgeHtml(res: Response) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Completing sign-in…</p><p style="margin:0;font-size:14px;opacity:.75">Returning to Yamma…</p><script>try{window.close();}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

export function sendGoogleOAuthCompleteHtml(res: Response) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Signed in</p><p style="margin:0;font-size:14px;opacity:.75">You can close this tab.</p></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

export function buildGoogleOAuthCallbackResultUrl(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const base = redirectUri.replace(/\/$/, '').split('?')[0];
  const q = new URLSearchParams(params).toString();
  return q ? `${base}?${q}` : base;
}

/** HTTPS URL openAuthSessionAsync waits for (not registered in Google Cloud). */
export function buildGoogleOAuthMobileDoneUrl(apiUrl: string, params: Record<string, string>): string {
  const base = `${apiUrl.replace(/\/$/, '')}/auth/google/mobile-done`;
  const q = new URLSearchParams(params).toString();
  return q ? `${base}?${q}` : base;
}
