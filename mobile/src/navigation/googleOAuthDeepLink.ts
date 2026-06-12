/** Parse OAuth result from the HTTPS API bridge redirect URL. */
export type GoogleOAuthReturn = {
  sessionId?: string;
  error?: string;
  code?: string;
};

const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';

export function parseGoogleOAuthReturnUrl(url: string): GoogleOAuthReturn | null {
  if (!url?.trim()) return null;

  try {
    const u = new URL(url);
    if (!u.pathname.replace(/\/$/, '').endsWith(EXPO_REDIRECT_PATH)) return null;

    const sessionId = u.searchParams.get('sessionId')?.trim() ?? '';
    const error = u.searchParams.get('error')?.trim() ?? '';
    const code = u.searchParams.get('code')?.trim() ?? '';

    if (sessionId) return { sessionId };
    if (error) return { error };
    if (code) return { code };
    return null;
  } catch {
    return null;
  }
}

export function readGoogleOAuthReturnFromAuthUrl(url: string): GoogleOAuthReturn | null {
  return parseGoogleOAuthReturnUrl(url);
}
