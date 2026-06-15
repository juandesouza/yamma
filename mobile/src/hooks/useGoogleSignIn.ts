import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import { useMemo } from 'react';
import type { GoogleOAuthClientIds } from '../config/google-oauth-config';
import { resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';

export function useGoogleAuthRequest(ids: GoogleOAuthClientIds) {
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);

  return Google.useAuthRequest({
    androidClientId: ids.androidClientId,
    iosClientId: ids.iosClientId,
    webClientId: ids.webClientId,
    redirectUri,
    useProxy: false,
    usePKCE: false,
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
