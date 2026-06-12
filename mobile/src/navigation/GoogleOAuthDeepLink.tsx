import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../auth/AuthContext';
import { parseGoogleOAuthReturnUrl } from './googleOAuthDeepLink';

/** Completes Google sign-in when the API bridge opens `exp://…/google-oauth?sessionId=…`. */
export function GoogleOAuthDeepLink() {
  const { signInWithSessionId, ready } = useAuth();
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    async function handle(url: string) {
      const parsed = parseGoogleOAuthReturnUrl(url);
      if (!parsed?.sessionId) return;
      if (lastSessionId.current === parsed.sessionId) return;
      lastSessionId.current = parsed.sessionId;

      await WebBrowser.dismissBrowser().catch(() => {});
      await WebBrowser.coolDownAsync().catch(() => {});

      const result = await signInWithSessionId(parsed.sessionId);
      if (!result.ok) {
        Alert.alert('Google sign-in failed', result.message ?? 'Try again or use email.');
      }
    }

    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    void Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });
    return () => sub.remove();
  }, [ready, signInWithSessionId]);

  return null;
}
