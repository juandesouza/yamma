import * as Google from 'expo-auth-session/providers/google';
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
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds } from '../config/google-oauth-config';
import {
  getGoogleOAuthRedirectPreview,
  resolveGoogleOAuthRedirectUri,
  resolveGoogleOAuthSessionDoneUri,
} from '../config/google-oauth-redirect';
import { parseGoogleOAuthSessionDoneUrl } from '../navigation/googleOAuthDeepLink';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const { signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);

  const clientIds = useMemo(() => resolveGoogleClientIds(), []);
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const sessionDoneUri = useMemo(() => resolveGoogleOAuthSessionDoneUri(), []);

  const [request] = Google.useAuthRequest(
    clientIds
      ? {
          webClientId: clientIds.webClientId,
          androidClientId: clientIds.androidClientId,
          iosClientId: clientIds.iosClientId,
          redirectUri,
          usePKCE: false,
          selectAccount: true,
          shouldAutoExchangeCode: false,
        }
      : {
          webClientId: 'missing',
          redirectUri,
          usePKCE: false,
        },
  );

  const finishSession = useCallback(
    async (sessionId: string) => {
      setBusy(true);
      try {
        await WebBrowser.dismissBrowser().catch(() => {});
        const { ok, message } = await signInWithSessionId(sessionId);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
      } finally {
        setBusy(false);
      }
    },
    [signInWithSessionId],
  );

  const configured = Boolean(clientIds);
  const waitingForGoogleRequest = configured && !request;
  const loading = busy || waitingForGoogleRequest;

  const onPress = async () => {
    if (!configured || !request) {
      Alert.alert(
        'Google sign-in not configured',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (same Web client as yamma-api on Render).',
      );
      return;
    }

    setBusy(true);
    try {
      const authUrl =
        request.url ?? (await request.makeAuthUrlAsync(Google.discovery));
      await WebBrowser.warmUpAsync();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, sessionDoneUri, {
        showInRecents: true,
        ...(Platform.OS === 'android' ? { createTask: false } : {}),
      });
      await WebBrowser.dismissBrowser().catch(() => {});
      await WebBrowser.coolDownAsync().catch(() => {});

      if (result.type === 'cancel' || result.type === 'dismiss') return;

      if (result.type !== 'success') {
        Alert.alert('Google sign-in failed', 'The sign-in browser closed unexpectedly. Try again.');
        return;
      }

      const parsed = parseGoogleOAuthSessionDoneUrl(result.url);
      if (parsed?.sessionId) {
        await finishSession(parsed.sessionId);
        return;
      }
      if (parsed?.error) {
        Alert.alert('Google sign-in failed', parsed.error);
        return;
      }

      Alert.alert(
        'Google sign-in incomplete',
        `Expected to return to:\n${sessionDoneUri}\n\nAdd the expo-redirect URI in Google Cloud if you have not already.`,
      );
    } catch (e) {
      Alert.alert(
        'Google sign-in failed',
        e instanceof Error ? e.message : 'Try again or use email.',
      );
    } finally {
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
