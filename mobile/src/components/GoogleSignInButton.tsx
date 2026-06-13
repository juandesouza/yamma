import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds, type GoogleOAuthClientIds } from '../config/google-oauth-config';
import {
  getGoogleOAuthRedirectPreview,
  readGoogleAuthCode,
  useGoogleAuthCode,
  useGoogleAuthRequest,
} from '../hooks/useGoogleSignIn';

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

function GoogleSignInButtonInner({
  disabled,
  variant,
  clientIds,
}: Props & { clientIds: GoogleOAuthClientIds }) {
  const { signInWithGoogleCode } = useAuth();
  const [busy, setBusy] = useState(false);

  const redirectUri = getGoogleOAuthRedirectPreview();
  const [request, response, promptAsync] = useGoogleAuthRequest(clientIds);

  const handleGoogleCode = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
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

  useGoogleAuthCode(response ?? null, (code) => {
    void handleGoogleCode(code);
  });

  useEffect(() => {
    if (!response || response.type !== 'success') return;
    if (readGoogleAuthCode(response)) return;
    setBusy(true);
    const timer = setTimeout(() => {
      setBusy(false);
      Alert.alert(
        'Google sign-in incomplete',
        `Google did not return a code. Add this redirect URI in Google Cloud (Web client):\n${redirectUri}`,
      );
    }, 25_000);
    return () => clearTimeout(timer);
  }, [response, redirectUri]);

  const waitingForGoogleRequest = !request;
  const loading = busy || waitingForGoogleRequest;

  const onPress = useCallback(async () => {
    if (!request) return;
    try {
      await WebBrowser.warmUpAsync();
      const r = await promptAsync({ showInRecents: true });
      if (r?.type === 'cancel' || r?.type === 'dismiss') return;
      if (r.type === 'error') {
        const msg =
          (r.error instanceof Error && r.error.message) ||
          (typeof r.params?.error_description === 'string' && r.params.error_description) ||
          (typeof r.params?.error === 'string' && r.params.error) ||
          'unknown';
        Alert.alert(
          'Google sign-in failed',
          `Google OAuth error (${msg}). Add this redirect URI in Google Cloud (Web client):\n${redirectUri}\n\nIf auth.expo.io shows "something went wrong", confirm owner is juandesouza and slug is yamma in app.config.js.`,
        );
        return;
      }
      const code = readGoogleAuthCode(r);
      if (code) {
        await handleGoogleCode(code);
      }
    } catch (e) {
      Alert.alert(
        'Google sign-in failed',
        `${e instanceof Error ? e.message : 'Try again or use email.'}\n\nRedirect URI:\n${redirectUri}`,
      );
    } finally {
      await WebBrowser.coolDownAsync();
    }
  }, [handleGoogleCode, promptAsync, redirectUri, request]);

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
