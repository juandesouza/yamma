import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { wakeApiHealth } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds, type GoogleOAuthClientIds } from '../config/google-oauth-config';
import {
  resolveGoogleOAuthAuthSessionReturnUri,
} from '../config/google-oauth-redirect';
import { useGoogleAuthRequest } from '../hooks/useGoogleSignIn';
import {
  parseGoogleOAuthErrorFromUrl,
  parseGoogleOAuthSessionIdFromUrl,
} from '../navigation/googleOAuthDeepLink';

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

function GoogleSignInButtonInner({
  disabled,
  variant,
  clientIds,
}: Props & { clientIds: GoogleOAuthClientIds }) {
  const { user, signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);

  const authSessionReturnUri = useMemo(() => resolveGoogleOAuthAuthSessionReturnUri(), []);
  const [request] = useGoogleAuthRequest(clientIds);

  const finishWithSessionUrl = useCallback(
    async (url: string | undefined) => {
      if (!url) return false;

      const oauthError = parseGoogleOAuthErrorFromUrl(url);
      if (oauthError) {
        Alert.alert('Google sign-in failed', oauthError);
        return true;
      }

      const sessionId = parseGoogleOAuthSessionIdFromUrl(url);
      if (!sessionId) return false;

      const { ok, message } = await signInWithSessionId(sessionId);
      if (!ok) {
        Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
      }
      return true;
    },
    [signInWithSessionId],
  );

  const onPress = useCallback(async () => {
    if (!request || user) return;

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

      const authUrl = request.url ?? (await request.makeAuthUrlAsync(Google.discovery));

      await WebBrowser.warmUpAsync();
      const browserResult = await WebBrowser.openAuthSessionAsync(authUrl, authSessionReturnUri);

      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
        return;
      }

      if (browserResult.type === 'success' || browserResult.type === 'opened') {
        const handled = await finishWithSessionUrl(
          browserResult.type === 'success' ? browserResult.url : undefined,
        );
        if (!handled && browserResult.type === 'opened') {
          Alert.alert(
            'Google sign-in incomplete',
            'The browser closed before we could finish sign-in. Try again.',
          );
        }
      } else if (browserResult.type === 'error') {
        Alert.alert(
          'Google sign-in failed',
          browserResult.error?.message ?? 'Try again or use email.',
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
  }, [authSessionReturnUri, finishWithSessionUrl, request, user]);

  const waitingForGoogleRequest = !request;
  const loading = busy || waitingForGoogleRequest;
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
            'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env.',
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
