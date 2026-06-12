import * as Linking from 'expo-linking';

export const GOOGLE_OAUTH_PATH = 'google-oauth';

export function buildGoogleOAuthResumeUrl(): string {
  return Linking.createURL(GOOGLE_OAUTH_PATH);
}

export function buildGoogleOAuthState(resumeUrl: string): string {
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${nonce}|${encodeURIComponent(resumeUrl)}`;
}

export type GoogleOAuthReturn = {
  sessionId?: string;
  error?: string;
  code?: string;
};

const EXPO_REDIRECT_PATH = '/auth/google/expo-redirect';

function parseHttpsBridgeUrl(url: string): GoogleOAuthReturn | null {
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

function parseAppDeepLink(url: string): GoogleOAuthReturn | null {
  const parsed = Linking.parse(url);
  const path = parsed.path ?? '';
  if (!path.includes(GOOGLE_OAUTH_PATH)) return null;

  const sessionId =
    typeof parsed.queryParams?.sessionId === 'string' ? parsed.queryParams.sessionId.trim() : '';
  const error =
    typeof parsed.queryParams?.error === 'string' ? parsed.queryParams.error.trim() : '';

  if (sessionId) return { sessionId };
  if (error) return { error };
  return null;
}

export function parseGoogleOAuthReturnUrl(url: string): GoogleOAuthReturn | null {
  if (!url?.trim()) return null;
  return parseAppDeepLink(url) ?? parseHttpsBridgeUrl(url);
}

export function readGoogleOAuthReturnFromAuthUrl(url: string): GoogleOAuthReturn | null {
  return parseGoogleOAuthReturnUrl(url);
}
