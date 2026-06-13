import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { wakeApiHealth } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds, type GoogleOAuthClientIds } from '../config/google-oauth-config';
import { getGoogleOAuthRedirectPreview, resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';
import { withGoogleMobileOAuthState } from '../config/google-oauth-state';
import { useGoogleAuthRequest } from '../hooks/useGoogleSignIn';
import {
  parseGoogleOAuthCodeFromUrl,
  parseGoogleOAuthErrorFromUrl,
  parseGoogleOAuthSessionIdFromUrl,
} from '../navigation/googleOAuthDeepLink';

WebBrowser.maybeCompleteAuthSession();

async function safeDismissBrowser(): Promise<void> {
  try {
    const result = WebBrowser.dismissBrowser();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await result;
    }
  } catch {
    /* unavailable in Expo Go on some platforms */
  }
}

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

function GoogleSignInButtonInner({
  disabled,
  variant,
  clientIds,
}: Props & { clientIds: GoogleOAuthClientIds }) {
  const { signInWithSessionId, signInWithGoogleCode } = useAuth();
  const [busy, setBusy] = useState(false);

  const googleRedirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const appReturnUri = useMemo(() => Linking.createURL('oauthredirect'), []);
  const [request] = useGoogleAuthRequest(clientIds);

  const finishFromReturnUrl = useCallback(
    async (url: string) => {
      const oauthError = parseGoogleOAuthErrorFromUrl(url);
      if (oauthError) {
        Alert.alert('Google sign-in failed', oauthError);
        return;
      }

      const sessionId = parseGoogleOAuthSessionIdFromUrl(url);
      if (sessionId) {
        const { ok, message } = await signInWithSessionId(sessionId);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
        return;
      }

      const code = parseGoogleOAuthCodeFromUrl(url);
      if (code) {
        const { ok, message } = await signInWithGoogleCode(code, googleRedirectUri);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
        return;
      }
    },
    [googleRedirectUri, signInWithGoogleCode, signInWithSessionId],
  );

  const waitingForGoogleRequest = !request;
  const loading = busy || waitingForGoogleRequest;

  const onPress = async () => {
    if (!request) return;

    setBusy(true);
    try {
      const apiReady = await wakeApiHealth();
      if (!apiReady) {
        Alert.alert(
          'API unreachable',
          'Could not reach the Yamma API. Wait a moment (Render may be waking up) and try again.',
        );
        return;
      }

      const rawAuthUrl =
        request.url ?? (await request.makeAuthUrlAsync(Google.discovery));
      const authUrl = withGoogleMobileOAuthState(rawAuthUrl, appReturnUri);

      await WebBrowser.warmUpAsync();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, googleRedirectUri, {
        showInRecents: true,
        ...(Platform.OS === 'android' ? { createTask: false } : {}),
      });
      await safeDismissBrowser();

      if (result.type === 'success' && result.url) {
        await finishFromReturnUrl(result.url);
        return;
      }

      if (result.type !== 'cancel' && result.type !== 'dismiss') {
        Alert.alert(
          'Google sign-in incomplete',
          `Confirm this redirect URI in Google Cloud (Web client):\n${getGoogleOAuthRedirectPreview()}`,
        );
      }
    } catch (e) {
      Alert.alert(
        'Google sign-in failed',
        e instanceof Error ? e.message : 'Try again or use email.',
      );
    } finally {
      try {
        await WebBrowser.coolDownAsync();
      } catch {
        /* optional */
      }
      setBusy(false);
    }
  };

  const verb = variant === 'register' ? 'Sign up' : 'Continue';

  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
      onPress={() => void onPress()}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color="#1f1f1f" />
      ) : (
        <View style={styles.row}>
          <GoogleMark />
          <Text style={styles.text}>{verb} with Google</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const clientIds = useMemo(() => resolveGoogleClientIds(), []);

  if (!clientIds) {
    return (
      <TouchableOpacity
        style={[styles.btn, styles.btnDisabled]}
        disabled
        onPress={() =>
          Alert.alert(
            'Google sign-in not configured',
            'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (same Web client as yamma-api on Render).',
          )
        }
      >
        <Text style={styles.text}>Continue with Google</Text>
      </TouchableOpacity>
    );
  }

  return <GoogleSignInButtonInner disabled={disabled} variant={variant} clientIds={clientIds} />;
}

function GoogleMark() {
  return (
    <View style={styles.iconWrap}>
      <Text style={styles.iconFallback}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3f4a',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  btnDisabled: { opacity: 0.65 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, fontWeight: '600', color: '#1f1f1f' },
  iconWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  iconFallback: { fontSize: 14, fontWeight: '800', color: '#4285F4' },
});
