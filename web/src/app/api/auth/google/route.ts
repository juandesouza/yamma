import { NextRequest, NextResponse } from 'next/server';
import { createGoogleOAuthState } from '@/lib/google-oauth-state';
import { oauthPublicOrigin } from '@/lib/oauth-public-origin';

/**
 * Starts Google OAuth. State is HMAC-signed (includes return path); no cookies required
 * for CSRF, so sign-in still works after the cross-site redirect from Google.
 */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const returnTo = from === 'register' ? '/register?loggedIn=1' : '/?loggedIn=1';

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const stateSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=google-web-not-configured', request.url));
  }
  if (!stateSecret) {
    return NextResponse.redirect(
      new URL('/login?error=google-missing-web-secret', request.url)
    );
  }

  const origin = oauthPublicOrigin(request);
  const callbackUrl = `${origin}/api/auth/google/callback`;
  const state = createGoogleOAuthState(returnTo, stateSecret, callbackUrl);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  return NextResponse.redirect(authUrl.toString());
}
