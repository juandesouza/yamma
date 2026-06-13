const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';
const MOBILE_DONE_PATH = '/auth/google/mobile-done';

function isOAuthCallbackUrl(url: URL): boolean {
  const path = url.pathname.replace(/\/$/, '');
  return path.endsWith(EXPO_REDIRECT_PATH) || path.endsWith(MOBILE_DONE_PATH);
}

function isAppOAuthReturnUrl(url: URL): boolean {
  if (url.protocol === 'yamma:') {
    return url.host === 'oauthredirect' || /oauthredirect/i.test(url.pathname);
  }
  if (url.protocol === 'exp:' || url.protocol === 'expo:') {
    return /oauthredirect/i.test(url.pathname);
  }
  return false;
}

function isGoogleOAuthReturnUrl(url: URL): boolean {
  return isOAuthCallbackUrl(url) || isAppOAuthReturnUrl(url);
}

/** Session id from API bridge or exp:// / yamma:// deep link. */
export function parseGoogleOAuthSessionIdFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!isGoogleOAuthReturnUrl(u)) return null;
    const sessionId = u.searchParams.get('sessionId')?.trim() ?? '';
    return sessionId || null;
  } catch {
    return null;
  }
}

/** Authorization code from Google redirect (client-side exchange fallback). */
export function parseGoogleOAuthCodeFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!isGoogleOAuthReturnUrl(u)) return null;
    if (u.searchParams.get('sessionId')?.trim()) return null;
    const code = u.searchParams.get('code')?.trim() ?? '';
    return code || null;
  } catch {
    return null;
  }
}

export function parseGoogleOAuthErrorFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!isGoogleOAuthReturnUrl(u)) return null;
    const error =
      u.searchParams.get('error_description')?.trim() ||
      u.searchParams.get('error')?.trim() ||
      '';
    return error || null;
  } catch {
    return null;
  }
}
