import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiUrl, wakeApiHealth } from '../api/client';
import { ngrokFetchHeaders } from '../config/api';
import { useAuth } from '../auth/AuthContext';
import { resolveGoogleClientIds, type GoogleOAuthClientIds } from '../config/google-oauth-config';
import { withGoogleMobileOAuthState } from '../config/google-oauth-state';
import { useGoogleAuthRequest } from '../hooks/useGoogleSignIn';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  variant?: 'login' | 'register';
};

type OAuthPollResult =
  | { status: 'pending' }
  | { status: 'ready'; sessionId: string }
  | { status: 'error'; error: string };

const POLL_MS = 800;
const POLL_TIMEOUT_MS = 90_000;

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

async function pollGoogleOAuthResult(state: string): Promise<OAuthPollResult> {
  const res = await fetch(apiUrl(`/auth/google/oauth-result?state=${encodeURIComponent(state)}`), {
    headers: ngrokFetchHeaders(),
  });
  if (!res.ok) {
    return { status: 'pending' };
  }
  const body = (await res.json()) as OAuthPollResult;
  return body;
}

function GoogleSignInButtonInner({
  disabled,
  variant,
  clientIds,
}: Props & { clientIds: GoogleOAuthClientIds }) {
  const { user, signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);
  const pollCancelRef = useRef(false);

  const appReturnUri = useMemo(() => Linking.createURL('oauthredirect'), []);
  const [request] = useGoogleAuthRequest(clientIds);

  const waitForOAuthResult = useCallback(async (state: string): Promise<OAuthPollResult> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (!pollCancelRef.current && Date.now() < deadline) {
      const result = await pollGoogleOAuthResult(state);
      if (result.status !== 'pending') {
        return result;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return { status: 'error', error: 'Timed out waiting for Google sign-in. Close the browser tab and try again.' };
  }, []);

  const onPress = useCallback(async () => {
    if (!request || user) return;

    pollCancelRef.current = false;
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
      const oauthState = new URL(authUrl).searchParams.get('state')?.trim() ?? '';
      if (!oauthState) {
        Alert.alert('Google sign-in failed', 'Could not start OAuth (missing state). Try again.');
        return;
      }

      await WebBrowser.warmUpAsync();
      void WebBrowser.openBrowserAsync(authUrl);

      const pollPromise = waitForOAuthResult(oauthState);
      const result = await pollPromise;
      await safeDismissBrowser();

      if (result.status === 'error') {
        Alert.alert('Google sign-in failed', result.error);
        return;
      }
      if (result.status === 'ready') {
        const { ok, message } = await signInWithSessionId(result.sessionId);
        if (ok) {
          await fetch(apiUrl(`/auth/google/oauth-complete?state=${encodeURIComponent(oauthState)}`), {
            method: 'POST',
            headers: ngrokFetchHeaders(),
          }).catch(() => {});
        } else {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
      }
    } catch (e) {
      Alert.alert(
        'Google sign-in failed',
        e instanceof Error ? e.message : 'Try again or use email.',
      );
    } finally {
      pollCancelRef.current = true;
      try {
        await WebBrowser.coolDownAsync();
      } catch {
        /* optional */
      }
      setBusy(false);
    }
  }, [appReturnUri, request, signInWithSessionId, user, waitForOAuthResult]);

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
