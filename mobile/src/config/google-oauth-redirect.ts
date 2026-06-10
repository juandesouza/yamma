import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/**
 * Google **Web** OAuth clients only allow https redirect URIs (not exp://).
 *
 * Prefer the Yamma API bridge (`/auth/google/expo-redirect`) — reliable in Expo Go.
 * The legacy Expo proxy (`auth.expo.io`) often shows "something went wrong" if the
 * project is not linked on expo.dev.
 */
export function resolveGoogleOAuthRedirectUri(): string {
  const override = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }

  const api = getApiBaseUrl().replace(/\/$/, '');
  if (api.startsWith('https://')) {
    return `${api}/auth/google/expo-redirect`;
  }

  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ scheme: 'yamma', path: 'oauthredirect' });
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    try {
      return AuthSession.getRedirectUrl();
    } catch {
      // Missing expo.owner — fall through.
    }
  }

  return AuthSession.makeRedirectUri({
    scheme: 'yamma',
    path: 'oauthredirect',
    native: 'yamma:/oauthredirect',
  });
}

/** Shown in alerts when Google returns OAuth errors — paste into Google Cloud Console. */
export function getGoogleOAuthRedirectPreview(): string {
  return resolveGoogleOAuthRedirectUri();
}
