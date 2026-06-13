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
import type { AuthSessionResult } from 'expo-auth-session';
import { wakeApiHealth } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds, type GoogleOAuthClientIds } from '../config/google-oauth-config';
import { getGoogleOAuthRedirectPreview, resolveGoogleOAuthRedirectUri } from '../config/google-oauth-redirect';
import {
  readGoogleAuthCode,
  readGoogleAuthError,
  readGoogleAuthSessionId,
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
  const { signInWithSessionId, signInWithGoogleCode } = useAuth();
  const [busy, setBusy] = useState(false);

  const googleRedirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const [request, response, promptAsync] = useGoogleAuthRequest(clientIds);

  const finishFromAuthResult = useCallback(
    async (result: AuthSessionResult) => {
      if (result.type === 'cancel' || result.type === 'dismiss') return;

      if (result.type === 'error') {
        const msg =
          (result.error instanceof Error && result.error.message) ||
          readGoogleAuthError(result) ||
          'Google sign-in failed';
        Alert.alert('Google sign-in failed', msg);
        return;
      }

      if (result.type !== 'success') {
        Alert.alert('Google sign-in failed', 'The sign-in browser closed unexpectedly. Try again.');
        return;
      }

      const oauthError = readGoogleAuthError(result);
      if (oauthError) {
        Alert.alert('Google sign-in failed', oauthError);
        return;
      }

      const sessionId = readGoogleAuthSessionId(result);
      if (sessionId) {
        const { ok, message } = await signInWithSessionId(sessionId);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
        return;
      }

      const code = readGoogleAuthCode(result);
      if (code) {
        const { ok, message } = await signInWithGoogleCode(code, googleRedirectUri);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
        return;
      }

      Alert.alert(
        'Google sign-in incomplete',
        `No session received. Confirm this redirect URI in Google Cloud (Web client):\n${getGoogleOAuthRedirectPreview()}`,
      );
    },
    [googleRedirectUri, signInWithGoogleCode, signInWithSessionId],
  );

  useEffect(() => {
    if (!response || response.type !== 'success') return;
    setBusy(true);
    void finishFromAuthResult(response).finally(() => setBusy(false));
  }, [finishFromAuthResult, response]);

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

      await WebBrowser.warmUpAsync();
      const result = await promptAsync({ showInRecents: true });
      await finishFromAuthResult(result);
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
