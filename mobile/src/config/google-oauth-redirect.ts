import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/**
 * Google OAuth redirect URI registered in Google Cloud (Web client).
 *
 * When `EXPO_PUBLIC_API_URL` is HTTPS we use the API bridge — works in Expo Go with
 * `useProxy: false` + promptAsync. auth.expo.io is unreliable ("something went wrong").
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
      return AuthSession.getRedirectUrl().replace(/\/$/, '');
    } catch {
      const owner = Constants.expoConfig?.owner ?? 'juandesouza';
      const slug = Constants.expoConfig?.slug ?? 'yamma';
      return `https://auth.expo.io/@${owner}/${slug}`;
    }
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

export function shouldUseGoogleOAuthProxy(): boolean {
  const uri = resolveGoogleOAuthRedirectUri();
  return uri.includes('auth.expo.io');
}
