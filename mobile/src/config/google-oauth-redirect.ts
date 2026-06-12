import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/** Google Cloud redirect URI (HTTPS). The API bridge then opens the app via `appReturnUri`. */
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

/** Deep link `openAuthSessionAsync` waits for after the HTTPS bridge (Expo Go → exp://, builds → yamma://). */
export function resolveGoogleOAuthAppReturnUri(): string {
  try {
    return Linking.createURL('oauthredirect');
  } catch {
    return AuthSession.makeRedirectUri({
      scheme: 'yamma',
      path: 'oauthredirect',
      native: 'yamma://oauthredirect',
    });
  }
}

export function getGoogleOAuthRedirectPreview(): string {
  return resolveGoogleOAuthRedirectUri();
}
