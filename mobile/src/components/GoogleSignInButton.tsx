import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
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
import {
  buildGoogleOAuthResumeUrl,
  buildGoogleOAuthState,
  parseGoogleOAuthReturnUrl,
} from '../navigation/googleOAuthDeepLink';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const { signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const clientIds = useMemo(() => resolveGoogleClientIds(), []);
  const redirectUri = useMemo(() => resolveGoogleOAuthRedirectUri(), []);
  const resumeUrl = useMemo(() => buildGoogleOAuthResumeUrl(), []);
  const oauthState = useMemo(() => buildGoogleOAuthState(resumeUrl), [resumeUrl]);

  const [request, , promptAsync] = Google.useAuthRequest(
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
        await WebBrowser.dismissBrowser().catch(() => {});
        await WebBrowser.coolDownAsync().catch(() => {});
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
    if (!configured) {
      Alert.alert(
        'Google sign-in not configured',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (same Web client as yamma-api on Render).',
      );
      return;
    }

    handledRef.current = false;
    setBusy(true);

    const onDeepLink = ({ url }: { url: string }) => {
      const parsed = parseGoogleOAuthReturnUrl(url);
      if (parsed?.sessionId) {
        void finishSession(parsed.sessionId);
      } else if (parsed?.error) {
        handledRef.current = true;
        setBusy(false);
        Alert.alert('Google sign-in failed', parsed.error);
      }
    };

    const linkSub = Linking.addEventListener('url', onDeepLink);

    try {
      await WebBrowser.warmUpAsync();
      const r = await promptAsync({
        showInRecents: true,
        ...(Platform.OS === 'android' ? { createTask: false } : {}),
      });

      if (!handledRef.current) {
        await WebBrowser.dismissBrowser().catch(() => {});
        await WebBrowser.coolDownAsync().catch(() => {});
      }

      if (handledRef.current) return;
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

      if (r?.type === 'success' && 'url' in r && typeof r.url === 'string') {
        const parsed = parseGoogleOAuthReturnUrl(r.url);
        if (parsed?.sessionId) {
          await finishSession(parsed.sessionId);
          return;
        }
      }

      Alert.alert(
        'Google sign-in incomplete',
        'Return to the Yamma app from the sign-in browser. If this keeps happening, restart Expo with: npx expo start --go -c',
      );
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
