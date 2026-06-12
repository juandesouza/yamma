import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds } from '../config/google-oauth-config';
import { getGoogleOAuthRedirectPreview, resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';
import { readGoogleOAuthReturnFromAuthUrl } from '../navigation/googleOAuthDeepLink';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

function readResultFromAuthSession(result: AuthSessionResult | null) {
  if (result?.type !== 'success' || !('url' in result) || typeof result.url !== 'string') {
    return null;
  }
  return readGoogleOAuthReturnFromAuthUrl(result.url);
}

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const { signInWithGoogleCode } = useAuth();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const clientIds = useMemo(() => resolveGoogleClientIds(), []);
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);

  const [request, , promptAsync] = Google.useAuthRequest(
    clientIds
      ? {
          webClientId: clientIds.webClientId,
          androidClientId: clientIds.androidClientId,
          iosClientId: clientIds.iosClientId,
          redirectUri,
          selectAccount: true,
          usePKCE: false,
          shouldAutoExchangeCode: false,
        }
      : {
          webClientId: 'missing',
          redirectUri,
          usePKCE: false,
        },
  );

  const finishWithCode = useCallback(
    async (code: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setBusy(true);
      try {
        await WebBrowser.dismissBrowser().catch(() => {});
        const { ok, message } = await signInWithGoogleCode(code, redirectUri);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
      } finally {
        setBusy(false);
      }
    },
    [redirectUri, signInWithGoogleCode],
  );

  const configured = Boolean(clientIds);
  const waitingForGoogleRequest = configured && !request;
  const loading = busy || waitingForGoogleRequest;

  const onPress = async () => {
    if (!configured) {
      Alert.alert(
        'Google sign-in not configured',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (same Web client as yamma-api on Render).',
      );
      return;
    }

    handledRef.current = false;
    setBusy(true);

    try {
      await WebBrowser.warmUpAsync();
      const r = await promptAsync({
        showInRecents: true,
        ...(Platform.OS === 'android' ? { createTask: false } : {}),
      });
      await WebBrowser.dismissBrowser().catch(() => {});
      await WebBrowser.coolDownAsync().catch(() => {});

      if (r?.type === 'cancel' || r?.type === 'dismiss') return;

      if (r?.type === 'error') {
        const raw =
          r.error?.message ??
          (typeof r.params?.error_description === 'string'
            ? r.params.error_description
            : typeof r.params?.error === 'string'
              ? r.params.error
              : 'Try again.');
        const isRedirectMismatch = /redirect_uri_mismatch/i.test(raw);
        const redirect = getGoogleOAuthRedirectPreview();
        Alert.alert(
          'Google sign-in failed',
          isRedirectMismatch
            ? `${raw}\n\nAdd this redirect URI in Google Cloud (Web client):\n${redirect}`
            : `${raw}\n\nRedirect URI: ${redirect}`,
        );
        return;
      }

      const parsed = readResultFromAuthSession(r);
      if (parsed?.error) {
        Alert.alert('Google sign-in failed', parsed.error);
        return;
      }
      if (parsed?.code) {
        await finishWithCode(parsed.code);
        return;
      }

      Alert.alert(
        'Google sign-in incomplete',
        'The browser closed before Yamma received a sign-in code. Try again.',
      );
    } finally {
      if (!handledRef.current) {
        setBusy(false);
      }
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
