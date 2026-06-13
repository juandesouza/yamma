import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo } from 'react';
import type { GoogleOAuthClientIds } from '../config/google-oauth-config';
import { resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';

WebBrowser.maybeCompleteAuthSession();

/** Authorization code flow; token exchange runs on yamma-api (GOOGLE_CLIENT_SECRET). */
export function useGoogleAuthRequest(ids: GoogleOAuthClientIds) {
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);

  return Google.useAuthRequest({
    androidClientId: ids.androidClientId,
    iosClientId: ids.iosClientId,
    webClientId: ids.webClientId,
    redirectUri,
    selectAccount: true,
    shouldAutoExchangeCode: false,
  });
}

export function getGoogleOAuthRedirectPreview(): string {
  return resolveGoogleOAuthRedirectUri();
}

export function readGoogleAuthCode(response: AuthSessionResult | null): string | null {
  if (response?.type !== 'success' || !('params' in response)) return null;
  const code = response.params.code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

export function useGoogleAuthCode(
  response: AuthSessionResult | null,
  onCode: (code: string) => void,
) {
  useEffect(() => {
    const code = readGoogleAuthCode(response);
    if (code) onCode(code);
  }, [response, onCode]);
}
