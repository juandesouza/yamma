import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

function expoGoAuthProxyRedirectUri(): string {
  const owner = Constants.expoConfig?.owner ?? 'juandesouza';
  const slug = Constants.expoConfig?.slug ?? 'yamma';
  try {
    const url = AuthSession.getRedirectUrl();
    if (url?.startsWith('https://auth.expo.io/')) return url.replace(/\/$/, '');
  } catch {
    /* fall through */
  }
  return `https://auth.expo.io/@${owner}/${slug}`;
}

/**
 * Google OAuth redirect URI.
 *
 * **Expo Go** must use `https://auth.expo.io/@owner/slug` — a custom API HTTPS redirect
 * closes the in-app browser before the account picker appears.
 *
 * **Dev builds / standalone** may use the API bridge (`/auth/google/expo-redirect`).
 */
export function resolveGoogleOAuthRedirectUri(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return expoGoAuthProxyRedirectUri();
  }

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

  return AuthSession.makeRedirectUri({
    scheme: 'yamma',
    path: 'oauthredirect',
    native: 'yamma://oauthredirect',
  });
}

export function getGoogleOAuthRedirectPreview(): string {
  return resolveGoogleOAuthRedirectUri();
}
