const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';

function isGoogleOAuthReturnUrl(url: URL): boolean {
  const path = url.pathname.replace(/\/$/, '');
  if (path.endsWith(EXPO_REDIRECT_PATH)) return true;
  if (url.protocol === 'yamma:' && /oauthredirect/i.test(url.pathname + url.host)) return true;
  if ((url.protocol === 'exp:' || url.protocol === 'expo:') && /oauthredirect/i.test(url.pathname)) {
    return true;
  }
  return false;
}

/** Authorization code from Google redirect URL (openAuthSessionAsync result). */
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
