const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';

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
  if (url.pathname.replace(/\/$/, '').endsWith(EXPO_REDIRECT_PATH)) return true;
  return isAppOAuthReturnUrl(url);
}

/** Authorization code from Google redirect (openAuthSessionAsync or deep link). */
export function parseGoogleOAuthCodeFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!isGoogleOAuthReturnUrl(u)) return null;
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
