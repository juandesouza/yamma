import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  buildGoogleOAuthResumeUrl,
  buildGoogleOAuthState,
  parseGoogleOAuthReturnUrl,
} from '../navigation/googleOAuthDeepLink';

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
  const { signInWithGoogleCode, signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const clientIds = useMemo(() => resolveGoogleClientIds(), []);
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const resumeUrl = useMemo(() => buildGoogleOAuthResumeUrl(), []);
  const oauthState = useMemo(() => buildGoogleOAuthState(resumeUrl), [resumeUrl]);

  const [request, response, promptAsync] = Google.useAuthRequest(
    clientIds
      ? {
          webClientId: clientIds.webClientId,
          androidClientId: clientIds.androidClientId,
          iosClientId: clientIds.iosClientId,
          redirectUri,
          state: oauthState,
          usePKCE: false,
          selectAccount: true,
          shouldAutoExchangeCode: false,
        }
      : {
          webClientId: 'missing',
          redirectUri,
          state: oauthState,
          usePKCE: false,
        },
  );

  const finishSession = useCallback(
    async (sessionId: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setBusy(true);
      try {
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

  const handleCode = useCallback(
    async (code: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
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
      const raw =
        response.error?.message ??
        (typeof response.params?.error_description === 'string'
          ? response.params.error_description
          : typeof response.params?.error === 'string'
            ? response.params.error
            : 'Try again.');
      const isRedirectMismatch = /redirect_uri_mismatch/i.test(raw);
      const redirect = getGoogleOAuthRedirectPreview();
      const hint = isRedirectMismatch
        ? `Google Cloud → Credentials → your **Web** OAuth client → Authorized redirect URIs must include exactly:\n${redirect}\n\n(Use the API URL above — not auth.expo.io — for Expo Go.)`
        : `Confirm that URI is in Google Cloud and restart Expo with: npx expo start --go -c\n\nRedirect URI: ${redirect}`;
      Alert.alert('Google sign-in failed', `${raw}\n\n${hint}`);
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

    handledRef.current = false;
    setBusy(true);

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const parsed = parseGoogleOAuthReturnUrl(url);
      if (!parsed) return;
      linkSub.remove();
      void WebBrowser.coolDownAsync().catch(() => {});
      if (parsed.sessionId) {
        void finishSession(parsed.sessionId);
        return;
      }
      if (parsed.error) {
        handledRef.current = true;
        setBusy(false);
        Alert.alert('Google sign-in failed', parsed.error);
      }
    });

    try {
      await WebBrowser.warmUpAsync();
      const r = await promptAsync({
        showInRecents: true,
        ...(Platform.OS === 'android' ? { createTask: false } : {}),
      });
      void WebBrowser.coolDownAsync().catch(() => {});

      if (r?.type === 'cancel' || r?.type === 'dismiss') return;

      const parsed = parseGoogleOAuthReturnUrl(r?.type === 'success' && 'url' in r ? r.url : '');
      if (parsed?.sessionId) {
        await finishSession(parsed.sessionId);
        return;
      }

      const code = readGoogleAuthCode(r);
      if (code) {
        await handleCode(code);
      }
    } finally {
      linkSub.remove();
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
