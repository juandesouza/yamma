const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';

/** Authorization code from Google redirect (openAuthSessionAsync result URL). */
export function parseGoogleOAuthCodeFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!u.pathname.replace(/\/$/, '').endsWith(EXPO_REDIRECT_PATH)) return null;
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
    if (!u.pathname.replace(/\/$/, '').endsWith(EXPO_REDIRECT_PATH)) return null;
    const error =
      u.searchParams.get('error_description')?.trim() ||
      u.searchParams.get('error')?.trim() ||
      '';
    return error || null;
  } catch {
    return null;
  }
}
