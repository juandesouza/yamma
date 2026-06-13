import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Google Web OAuth clients only allow http(s) redirect URIs (not exp://).
 * Expo Go must use the HTTPS proxy: https://auth.expo.io/@owner/slug (same as Nexo).
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
      /* missing expo.owner — caller should surface env hint */
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
