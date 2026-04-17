import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Packs return path + expiry into the OAuth `state` param (HMAC-signed).
 * Avoids relying on cookies surviving the round-trip from accounts.google.com.
 */
export function createGoogleOAuthState(returnTo: string, secret: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  const nonce = randomBytes(16).toString('hex');
  const payload = JSON.stringify({ exp, returnTo, nonce });
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(payload, 'utf8').toString('base64url') + '.' + sig;
}

export function parseGoogleOAuthState(
  state: string,
  secret: string
): { returnTo: string } | null {
  const lastDot = state.lastIndexOf('.');
  if (lastDot < 1) return null;
  const b64 = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let data: { exp: number; returnTo: string; nonce: string };
  try {
    data = JSON.parse(payload) as { exp: number; returnTo: string; nonce: string };
  } catch {
    return null;
  }
  if (typeof data.exp !== 'number' || typeof data.returnTo !== 'string') return null;
  if (Date.now() > data.exp) return null;
  if (!data.returnTo.startsWith('/') || data.returnTo.startsWith('//')) return null;
  return { returnTo: data.returnTo };
}
