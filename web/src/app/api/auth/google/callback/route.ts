import { NextRequest, NextResponse } from 'next/server';
import { parseGoogleOAuthState } from '@/lib/google-oauth-state';
import { oauthPublicOrigin } from '@/lib/oauth-public-origin';

/** Prefer INTERNAL_API_URL for server-side fetch if localhost misbehaves. */
const API =
  process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export async function GET(request: NextRequest) {
  const loginError = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, request.url));

  const oauthErr = request.nextUrl.searchParams.get('error');
  if (oauthErr) {
    const desc = request.nextUrl.searchParams.get('error_description');
    if (process.env.NODE_ENV === 'development' && desc) {
      console.error('[google/callback] OAuth error:', oauthErr, desc);
    }
    return loginError(`google-${oauthErr}`);
  }

  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const stateSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!code || !stateParam) {
    console.error('[google/callback] missing code or state');
    return loginError('google-state-mismatch');
  }

  if (!stateSecret) {
    console.error('[google/callback] GOOGLE_CLIENT_SECRET not set on web server');
    return loginError('google-missing-web-secret');
  }

  const parsed = parseGoogleOAuthState(stateParam, stateSecret);
  if (!parsed) {
    console.error(
      '[google/callback] invalid or expired state (cookie no longer required; check GOOGLE_CLIENT_SECRET matches backend)'
    );
    return loginError('google-state-mismatch');
  }
  const returnTo = parsed.returnTo;

  const redirectUri =
    parsed.redirectUri ?? `${oauthPublicOrigin(request)}/api/auth/google/callback`;

  let exchange: Response;
  try {
    exchange = await fetch(`${API}/auth/google/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    });
  } catch (e) {
    console.error('[google/callback] fetch to API failed:', e);
    return loginError('google-api-unreachable');
  }

  const rawText = await exchange.text();
  let payload: { message?: string | string[]; sessionId?: string } = {};
  try {
    payload = rawText ? (JSON.parse(rawText) as typeof payload) : {};
  } catch {
    console.error('[google/callback] non-JSON API response', exchange.status, rawText.slice(0, 400));
    return loginError('google-sign-in-failed');
  }

  if (!exchange.ok) {
    const msg = Array.isArray(payload?.message)
      ? payload.message.join(' ')
      : typeof payload?.message === 'string'
        ? payload.message
        : '';
    console.error('[google/callback] exchange failed', exchange.status, msg || rawText.slice(0, 500));
    const m = msg.toLowerCase();
    let code = 'google-sign-in-failed';
    if (
      m.includes('redirect_uri_mismatch') ||
      m.includes('redirect uri') ||
      m.includes('invalid redirect')
    ) {
      code = 'google-bad-redirect';
    } else if (m.includes('invalid_grant') || m.includes('bad_verification_code')) {
      code = 'google-token-used';
    } else if (m.includes('token exchange') || m.includes('token missing')) {
      code = 'google-token';
    } else if (m.includes('userinfo')) {
      code = 'google-userinfo';
    } else if (m.includes('not verified')) {
      code = 'google-email-not-verified';
    } else if (m.includes('email')) {
      code = 'google-email';
    } else if (m.includes('not configured')) {
      code = 'google-not-configured';
    } else if (m.includes('google sign-in server error')) {
      code = 'google-server-error';
    }
    return loginError(code);
  }

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
  if (!sessionId) {
    console.error('[google/callback] missing sessionId in success body');
    return loginError('google-sign-in-failed');
  }

  const redirect = NextResponse.redirect(new URL(returnTo, request.url));
  redirect.cookies.set('yamma_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  });
  return redirect;
}
