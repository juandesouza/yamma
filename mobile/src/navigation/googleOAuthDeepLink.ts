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
};

export function parseGoogleOAuthReturnUrl(url: string): GoogleOAuthReturn | null {
  const parsed = Linking.parse(url);
  const path = parsed.path ?? '';
  if (!path.includes(GOOGLE_OAUTH_PATH)) return null;

  const sessionId =
    typeof parsed.queryParams?.sessionId === 'string' ? parsed.queryParams.sessionId.trim() : '';
  const error =
    typeof parsed.queryParams?.error === 'string' ? parsed.queryParams.error.trim() : '';

  if (!sessionId && !error) return null;
  return {
    ...(sessionId ? { sessionId } : {}),
    ...(error ? { error } : {}),
  };
}
