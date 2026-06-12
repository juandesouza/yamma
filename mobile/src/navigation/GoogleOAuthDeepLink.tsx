import * as Linking from 'expo-linking';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';
import {
  parseGoogleOAuthCodeFromUrl,
  parseGoogleOAuthErrorFromUrl,
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

/** Fallback when the HTTPS bridge opens exp:// / yamma:// outside openAuthSessionAsync. */
export function GoogleOAuthDeepLink() {
  const { user, signInWithGoogleCode } = useAuth();
  const googleRedirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const lastCode = useRef<string | null>(null);

  useEffect(() => {
    if (user) return;

    async function handle(url: string) {
      const oauthError = parseGoogleOAuthErrorFromUrl(url);
      if (oauthError) {
        Alert.alert('Google sign-in failed', oauthError);
        return;
      }

      const code = parseGoogleOAuthCodeFromUrl(url);
      if (!code || lastCode.current === code) return;
      lastCode.current = code;

      await safeDismissBrowser();
      const { ok, message } = await signInWithGoogleCode(code, googleRedirectUri);
      if (!ok) {
        Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
      }
    }

    const sub = Linking.addEventListener('url', (event) => {
      void handle(event.url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });
    return () => sub.remove();
  }, [googleRedirectUri, signInWithGoogleCode, user]);

  return null;
}
