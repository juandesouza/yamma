type PendingGoogleOAuth = {
  sessionId?: string;
  error?: string;
  expiresAt: number;
};

const pending = new Map<string, PendingGoogleOAuth>();
const TTL_MS = 10 * 60 * 1000;

function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(key);
  }
}

export function setGoogleOAuthPending(
  state: string,
  result: { sessionId?: string; error?: string },
): void {
  purgeExpired();
  pending.set(state, { ...result, expiresAt: Date.now() + TTL_MS });
}

/** Read without removing (mobile may poll concurrently). */
export function peekGoogleOAuthPending(state: string): {
  sessionId?: string;
  error?: string;
} | null {
  purgeExpired();
  const entry = pending.get(state);
  if (!entry) return null;
  return { sessionId: entry.sessionId, error: entry.error };
}

/** One-time cleanup after the app finishes sign-in. */
export function takeGoogleOAuthPending(state: string): {
  sessionId?: string;
  error?: string;
} | null {
  purgeExpired();
  const entry = pending.get(state);
  if (!entry) return null;
  pending.delete(state);
  return { sessionId: entry.sessionId, error: entry.error };
}
