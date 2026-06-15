import * as Linking from 'expo-linking';
import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../auth/AuthContext';
import {
  parseGoogleOAuthErrorFromUrl,
  parseGoogleOAuthSessionIdFromUrl,
} from './googleOAuthDeepLink';

async function safeDismissBrowser(): Promise<void> {
  try {
    const result = WebBrowser.dismissBrowser();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await result;
    }
  } catch {
    /* unavailable in Expo Go on some platforms */
  }
}

/** Receives exp://oauthredirect?sessionId= from the API bridge (payment-return pattern). */
export function GoogleOAuthDeepLink() {
  const { user, signInWithSessionId } = useAuth();
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (user) return;

    async function handle(url: string) {
      if (!/oauthredirect/i.test(url)) return;

      const oauthError = parseGoogleOAuthErrorFromUrl(url);
      if (oauthError) {
        Alert.alert('Google sign-in failed', oauthError);
        return;
      }

      const sessionId = parseGoogleOAuthSessionIdFromUrl(url);
      if (!sessionId || lastSessionId.current === sessionId) return;
      lastSessionId.current = sessionId;

      await safeDismissBrowser();
      const { ok, message } = await signInWithSessionId(sessionId);
      if (!ok) {
        Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
      }
    }

    const sub = Linking.addEventListener('url', (event) => {
      void handle(event.url);
    });
    return () => sub.remove();
  }, [signInWithSessionId, user]);

  return null;
}
