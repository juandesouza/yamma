import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/**
 * Google **Web** OAuth clients only allow https redirect URIs (not exp://).
 *
 * Expo Go: use the Yamma API bridge (`/auth/google/expo-redirect`). Google redirects there
 * with `?code=…`; `openAuthSessionAsync` captures that URL and the app exchanges the code.
 *
 * Do **not** use `https://auth.expo.io/...` as redirect_uri unless you go through Expo's
 * deprecated proxy `/start` flow — opening Google directly with auth.expo.io shows
 * "something went wrong trying to finish signing in".
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
    const owner = Constants.expoConfig?.owner;
    const slug = Constants.expoConfig?.slug;
    if (owner && slug) {
      return `https://auth.expo.io/@${owner}/${slug}`;
    }
    try {
      return AuthSession.getRedirectUrl();
    } catch {
      return 'https://auth.expo.io/@juandesouza/yamma';
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
