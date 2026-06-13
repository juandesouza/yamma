import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './api';

/**
 * Google OAuth redirect URI (registered in Google Cloud Web client).
 * Expo Go uses the yamma-api HTTPS bridge — same idea as Lemon payment return URLs.
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

/** HTTPS URL `openAuthSessionAsync` waits for after Google redirects to expo-redirect (Lemon checkout pattern). */
export function resolveGoogleOAuthAuthSessionReturnUri(): string {
  const override = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_SESSION_RETURN_URI?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }

  const oauthRedirect = resolveGoogleOAuthRedirectUri();
  if (oauthRedirect.startsWith('https://')) {
    const origin = new URL(oauthRedirect).origin;
    return `${origin}/auth/google/mobile-done`;
  }

  const api = getApiBaseUrl().replace(/\/$/, '');
  if (api.startsWith('https://')) {
    return `${api}/auth/google/mobile-done`;
  }

  return `${api}/auth/google/mobile-done`;
}
