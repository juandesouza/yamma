import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/** Registered in Google Cloud — Google + openAuthSessionAsync both use this URL. */
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

export function getGoogleOAuthRedirectPreview(): string {
  return resolveGoogleOAuthRedirectUri();
}
