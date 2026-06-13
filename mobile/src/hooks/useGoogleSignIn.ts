import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import type { GoogleOAuthClientIds } from '../config/google-oauth-config';
import { resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';
import {
  parseGoogleOAuthErrorFromUrl,
  parseGoogleOAuthSessionIdFromUrl,
} from '../navigation/googleOAuthDeepLink';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuthRequest(ids: GoogleOAuthClientIds) {
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);

  return Google.useAuthRequest({
    androidClientId: ids.androidClientId,
    iosClientId: ids.iosClientId,
    webClientId: ids.webClientId,
    redirectUri,
    usePKCE: false,
    selectAccount: true,
    shouldAutoExchangeCode: false,
  });
}

export function readGoogleAuthSessionId(response: AuthSessionResult | null): string | null {
  if (response?.type !== 'success' || !('params' in response)) return null;
  const fromParams = response.params.sessionId;
  if (typeof fromParams === 'string' && fromParams.trim()) return fromParams.trim();
  if (typeof response.url === 'string') {
    return parseGoogleOAuthSessionIdFromUrl(response.url);
  }
  return null;
}

export function readGoogleAuthCode(response: AuthSessionResult | null): string | null {
  if (response?.type !== 'success' || !('params' in response)) return null;
  const code = response.params.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

export function readGoogleAuthError(response: AuthSessionResult | null): string | null {
  if (!response) return null;
  if (response.type === 'error') {
    if (response.error instanceof Error && response.error.message) return response.error.message;
    return 'Google sign-in failed';
  }
  if (response.type !== 'success' || !('params' in response)) return null;
  const fromParams =
    (typeof response.params.error_description === 'string' && response.params.error_description) ||
    (typeof response.params.error === 'string' && response.params.error) ||
    '';
  if (fromParams.trim()) return fromParams.trim();
  if (typeof response.url === 'string') {
    return parseGoogleOAuthErrorFromUrl(response.url);
  }
  return null;
}
