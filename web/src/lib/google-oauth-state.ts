import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 10 * 60 * 1000;

function validateRedirectUriForState(redirectUri: unknown): redirectUri is string {
  if (typeof redirectUri !== 'string' || !redirectUri) return false;
  let u: URL;
  try {
    u = new URL(redirectUri);
  } catch {
    return false;
  }
  if (u.pathname !== '/api/auth/google/callback') return false;
  if (u.search || u.hash) return false;
  const isLocalHttp =
    u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (isLocalHttp) return true;
  return u.protocol === 'https:';
}

/**
 * Packs return path, OAuth redirect_uri, and expiry into the `state` param (HMAC-signed).
 * `redirectUri` must match the authorize request exactly so the token exchange succeeds.
 */
export function createGoogleOAuthState(returnTo: string, secret: string, redirectUri: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  const nonce = randomBytes(16).toString('hex');
  const payload = JSON.stringify({ exp, returnTo, nonce, redirectUri });
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(payload, 'utf8').toString('base64url') + '.' + sig;
}

export function parseGoogleOAuthState(
  state: string,
  secret: string
): { returnTo: string; redirectUri?: string } | null {
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
  let data: { exp: number; returnTo: string; nonce: string; redirectUri?: string };
  try {
    data = JSON.parse(payload) as typeof data;
  } catch {
    return null;
  }
  if (typeof data.exp !== 'number' || typeof data.returnTo !== 'string') return null;
  if (Date.now() > data.exp) return null;
  if (!data.returnTo.startsWith('/') || data.returnTo.startsWith('//')) return null;

  if (data.redirectUri !== undefined) {
    if (!validateRedirectUriForState(data.redirectUri)) return null;
    return { returnTo: data.returnTo, redirectUri: data.redirectUri };
  }
  return { returnTo: data.returnTo };
}
