import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Google **Web** OAuth clients only allow https redirect URIs (not exp://).
 * Expo Go must use: https://auth.expo.io/@owner/slug
 *
 * Set `owner` in app.config.js (or EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI in mobile/.env).
 */
export function resolveGoogleOAuthRedirectUri(): string {
  const override = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ scheme: 'yamma', path: 'oauthredirect' });
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    try {
      return AuthSession.getRedirectUrl();
    } catch {
      // Missing expo.owner — fall through to explicit default below.
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
