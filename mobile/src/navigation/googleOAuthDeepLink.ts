/** Parse the mobile OAuth completion URL returned by openAuthSessionAsync. */
export type GoogleOAuthSessionDone = {
  sessionId?: string;
  error?: string;
};

const SESSION_DONE_PATH = '/auth/google/mobile-done';

export function parseGoogleOAuthSessionDoneUrl(url: string): GoogleOAuthSessionDone | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    if (!u.pathname.replace(/\/$/, '').endsWith(SESSION_DONE_PATH)) return null;

    const sessionId = u.searchParams.get('sessionId')?.trim() ?? '';
    const error = u.searchParams.get('error')?.trim() ?? '';
    if (sessionId) return { sessionId };
    if (error) return { error };
    return null;
  } catch {
    return null;
  }
}
