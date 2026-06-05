export type GoogleOAuthClientIds = {
  androidClientId: string;
  iosClientId: string;
  webClientId: string;
};

/**
 * Expo's Google provider requires `androidClientId` on Android and `iosClientId` on iOS.
 * For Expo Go, reuse the **Web** client ID for native fields — no Android keystore / SHA-1 needed.
 */
export function resolveGoogleClientIds(): GoogleOAuthClientIds | null {
  const web =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?.trim() ||
    undefined;
  const android = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;

  const anyId = web ?? android ?? ios;
  if (!anyId) return null;

  return {
    webClientId: (web ?? android ?? ios) as string,
    androidClientId: (android ?? web ?? ios) as string,
    iosClientId: (ios ?? web ?? android) as string,
  };
}
