import { Platform } from 'react-native';

/**
 * API base URL for the Nest backend.
 *
 * - **Expo env:** set `EXPO_PUBLIC_API_URL` in `mobile/.env` (see `.env.example`).
 * - **Android emulator:** defaults to `http://10.0.2.2:3001` (host machine’s localhost).
 * - **iOS simulator:** defaults to `http://localhost:3001`.
 * - **Physical device:** set `EXPO_PUBLIC_API_URL` to your computer’s LAN IP, e.g. `http://192.168.1.5:3001`,
 *   and ensure the backend allows CORS (development mode already uses `origin: true`).
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (!__DEV__) {
    return 'http://localhost:3001';
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * ngrok’s free tier may return an HTML interstitial unless this header is sent on every request.
 * Use with `fetch(..., { headers: { ...ngrokFetchHeaders(), ... } })`.
 */
export function ngrokFetchHeaders(): Record<string, string> {
  if (!API_BASE_URL.includes('ngrok')) return {};
  return { 'ngrok-skip-browser-warning': 'true' };
}
