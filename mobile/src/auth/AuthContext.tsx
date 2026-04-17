import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl, authedFetch, messageFromApiBody, postJson } from '../api/client';
import type { AuthUser } from '../types/auth';

const STORAGE_SESSION = 'yamma_session_id';
const STORAGE_USER = 'yamma_user_json';

async function clearStoredSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_SESSION);
  await AsyncStorage.removeItem(STORAGE_USER);
}

type AuthResponse = {
  sessionId?: string;
  user?: AuthUser;
  message?: string;
};

function failMessage(
  prefix: string,
  result: { networkError?: string; data: { message?: unknown }; status: number },
): string {
  if (result.networkError) return result.networkError;
  return messageFromApiBody(result.data) ?? `${prefix} (HTTP ${result.status || '?'})`;
}

type AuthContextValue = {
  ready: boolean;
  sessionId: string | null;
  user: AuthUser | null;
  signInWithSession: (sessionId: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  guestSession: (role: 'buyer' | 'seller') => Promise<{ ok: boolean; message?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string }>;
  registerAccount: (input: {
    name: string;
    email: string;
    password: string;
    accountType: 'buyer' | 'seller';
  }) => Promise<{ ok: boolean; message?: string }>;
  signInWithGoogleIdToken: (idToken: string) => Promise<{ ok: boolean; message?: string }>;
  fetchAuthed: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = await AsyncStorage.getItem(STORAGE_SESSION);
        if (!sid) return;
        const res = await fetch(apiUrl('/auth/me'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${sid}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { user: AuthUser };
          setSessionId(sid);
          setUser(body.user);
        } else {
          await clearStoredSession();
        }
      } catch {
        await clearStoredSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithSession = useCallback(async (sid: string, u: AuthUser) => {
    await AsyncStorage.setItem(STORAGE_SESSION, sid);
    await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setSessionId(sid);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    const sid = sessionId ?? (await AsyncStorage.getItem(STORAGE_SESSION));
    if (sid) {
      try {
        await authedFetch(sid, '/auth/logout', { method: 'POST' });
      } catch {
        /* ignore */
      }
    }
    await clearStoredSession();
    setSessionId(null);
    setUser(null);
  }, [sessionId]);

  const fetchAuthed = useCallback(
    (path: string, init?: RequestInit) => {
      if (!sessionId) {
        return Promise.reject(new Error('Not authenticated'));
      }
      return authedFetch(sessionId, path, init);
    },
    [sessionId],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const result = await postJson<AuthResponse>('/auth/login', { email, password });
      if (result.networkError || !result.ok) {
        return { ok: false, message: failMessage('Login failed', result) };
      }
      const { data } = result;
      if (!data.sessionId || !data.user) {
        return {
          ok: false,
          message: 'Server did not return a session. Restart the API so it includes sessionId in JSON (or update the app).',
        };
      }
      await signInWithSession(data.sessionId, data.user);
      return { ok: true };
    },
    [signInWithSession],
  );

  const registerAccount = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      accountType: 'buyer' | 'seller';
    }) => {
      const result = await postJson<AuthResponse>('/auth/register', input);
      if (result.networkError || !result.ok) {
        return { ok: false, message: failMessage('Registration failed', result) };
      }
      return { ok: true };
    },
    [],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await postJson<{ message?: string }>('/auth/forgot-password', { email });
    if (result.networkError || !result.ok) {
      return { ok: false, message: failMessage('Password reset failed', result) };
    }
    return {
      ok: true,
      message: result.data?.message ?? 'If an account exists for this email, we sent a reset link.',
    };
  }, []);

  const guestSession = useCallback(
    async (role: 'buyer' | 'seller') => {
      const result = await postJson<AuthResponse>('/auth/guest-session', {
        role: role === 'seller' ? 'seller' : 'buyer',
      });
      if (result.networkError || !result.ok) {
        return { ok: false, message: failMessage('Guest sign-in failed', result) };
      }
      const { data } = result;
      if (!data.sessionId || !data.user) {
        return {
          ok: false,
          message:
            'Server did not return a session. Restart the Nest API after updating it, or check EXPO_PUBLIC_API_URL on your phone.',
        };
      }
      await signInWithSession(data.sessionId, data.user);
      return { ok: true };
    },
    [signInWithSession],
  );

  const signInWithGoogleIdToken = useCallback(
    async (idToken: string) => {
      const result = await postJson<AuthResponse>('/auth/google/id-token', { idToken });
      if (result.networkError || !result.ok) {
        return { ok: false, message: failMessage('Google sign-in failed', result) };
      }
      const { data } = result;
      if (!data.sessionId || !data.user) {
        return { ok: false, message: 'Google sign-in did not return a session.' };
      }
      await signInWithSession(data.sessionId, data.user);
      return { ok: true };
    },
    [signInWithSession],
  );

  const value = useMemo(
    () => ({
      ready,
      sessionId,
      user,
      signInWithSession,
      signOut,
      guestSession,
      loginWithEmail,
      requestPasswordReset,
      registerAccount,
      signInWithGoogleIdToken,
      fetchAuthed,
    }),
    [
      ready,
      sessionId,
      user,
      signInWithSession,
      signOut,
      guestSession,
      loginWithEmail,
      requestPasswordReset,
      registerAccount,
      signInWithGoogleIdToken,
      fetchAuthed,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
