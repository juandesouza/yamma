import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds } from '../config/google-oauth-config';
import { getGoogleOAuthRedirectPreview, resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  /** "Sign in" vs "Sign up" label only */
  variant?: 'login' | 'register';
};

function readGoogleAuthCode(response: AuthSessionResult | null): string | null {
  if (response?.type !== 'success' || !('params' in response)) return null;
  const code = response.params.code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const { signInWithGoogleCode } = useAuth();
  const [busy, setBusy] = useState(false);

  const clientIds = useMemo(() => resolveGoogleClientIds(), []);
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);

  const [request, response, promptAsync] = Google.useAuthRequest(
    clientIds
      ? {
          webClientId: clientIds.webClientId,
          androidClientId: clientIds.androidClientId,
          iosClientId: clientIds.iosClientId,
          redirectUri,
          selectAccount: true,
          shouldAutoExchangeCode: false,
        }
      : {
          webClientId: 'missing',
          redirectUri,
        },
  );

  const handleCode = useCallback(
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

  useEffect(() => {
    const code = readGoogleAuthCode(response ?? null);
    if (code) {
      void handleCode(code);
      return;
    }
    if (response?.type === 'error') {
      const msg =
        response.error?.message ??
        (typeof response.params?.error_description === 'string'
          ? response.params.error_description
          : 'Try again.');
      Alert.alert(
        'Google sign-in failed',
        `${msg}\n\nAdd this redirect URI to your Google Cloud **Web** OAuth client:\n${getGoogleOAuthRedirectPreview()}`,
      );
    }
  }, [response, handleCode]);

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
    try {
      await WebBrowser.warmUpAsync();
      const r = await promptAsync({ showInRecents: true });
      if (r?.type === 'cancel' || r?.type === 'dismiss') return;
      const code = readGoogleAuthCode(r);
      if (code) await handleCode(code);
    } finally {
      await WebBrowser.coolDownAsync();
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
