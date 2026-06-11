import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../auth/AuthContext';
import { parseGoogleOAuthReturnUrl } from './googleOAuthDeepLink';

/**
 * Completes Google sign-in when the API bridge redirects to `exp://…/google-oauth?sessionId=…`.
 */
export function GoogleOAuthDeepLink() {
  const { signInWithSessionId, ready } = useAuth();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    async function handle(url: string) {
      const parsed = parseGoogleOAuthReturnUrl(url);
      if (!parsed) return;
      if (lastUrl.current === url) return;
      lastUrl.current = url;

      void WebBrowser.coolDownAsync().catch(() => {});

      if (parsed.sessionId) {
        const result = await signInWithSessionId(parsed.sessionId);
        if (!result.ok) {
          Alert.alert('Google sign-in failed', result.message ?? 'Try again or use email.');
        }
        return;
      }
      if (parsed.error) {
        Alert.alert('Google sign-in failed', parsed.error);
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
