import type { Response } from 'express';

const APP_SCHEME = 'yamma';

/** Deep links allowed when resuming into the mobile app from an HTTPS bridge page. */
export function parseAllowedAppResumeUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  let t = url.trim();
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

/** OAuth `state` carries `nonce|encodeURIComponent(exp://…)` from the mobile authorize request. */
export function parseResumeUrlFromOAuthState(state: string | undefined): string | null {
  if (!state?.trim()) return null;
  const pipe = state.indexOf('|');
  if (pipe <= 0) return null;
  return parseAllowedAppResumeUrl(state.slice(pipe + 1));
}

export function defaultGoogleOAuthResumeUrl(): string {
  return `${APP_SCHEME}://google-oauth`;
}

export function appendQueryToUrl(base: string, params: Record<string, string>): string {
  const sep = base.includes('?') ? '&' : '?';
  const q = new URLSearchParams(params).toString();
  return q ? `${base}${sep}${q}` : base;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Minimal HTML that immediately opens `exp://` / `yamma://` (used after HTTPS OAuth bridges). */
export function sendResumeHtml(res: Response, target: string) {
  const href = escapeHtmlAttr(target);
  const js = JSON.stringify(target);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="refresh" content="0;url=${href}"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Opening Yamma…</p><p style="margin:0;font-size:14px;opacity:.75">If nothing happens, tap below.</p><p style="margin-top:20px"><a href="${href}" style="color:#ff9a66;font-weight:600;font-size:16px">Open in app</a></p><script>try{location.replace(${js});}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}
