import type { Response } from 'express';

/** Shown while the app receives the OAuth code via openAuthSessionAsync (no exp:// redirects). */
export function sendGoogleOAuthBridgeHtml(res: Response) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Completing sign-in…</p><p style="margin:0;font-size:14px;opacity:.75">Return to the Yamma app.</p></body></html>`;
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
