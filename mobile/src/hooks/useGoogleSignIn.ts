import * as Google from 'expo-auth-session/providers/google';
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
