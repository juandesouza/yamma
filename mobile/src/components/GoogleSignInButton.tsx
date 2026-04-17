import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  /** "Sign in" vs "Sign up" label only */
  variant?: 'login' | 'register';
};

export default function GoogleSignInButton({ disabled, variant = 'login' }: Props) {
  const { signInWithGoogleIdToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?.trim();
  const androidExplicit = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
  const iosExplicit = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const androidClientId = androidExplicit || webClientId;
  const iosClientId = iosExplicit || webClientId;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId || undefined,
    androidClientId: androidClientId || undefined,
    iosClientId: iosClientId || undefined,
  });

  const onToken = useCallback(
    async (idToken: string) => {
      setBusy(true);
      try {
        const { ok, message } = await signInWithGoogleIdToken(idToken);
        if (!ok) {
          Alert.alert('Google sign-in failed', message ?? 'Try again or use email.');
        }
      } finally {
        setBusy(false);
      }
    },
    [signInWithGoogleIdToken],
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (typeof idToken === 'string' && idToken.length > 0) {
        void onToken(idToken);
      } else {
        Alert.alert('Google sign-in failed', 'No ID token returned. Check OAuth client IDs in mobile/.env.');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Google sign-in failed', response.error?.message ?? 'Try again.');
    }
  }, [response, onToken]);

  const configured = Boolean(webClientId);
  const waitingForGoogleRequest = configured && !request;
  const loading = busy || waitingForGoogleRequest;

  const onPress = () => {
    if (!configured) {
      Alert.alert(
        'Google sign-in not configured',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env.',
      );
      return;
    }
    void promptAsync();
  };

  const verb = variant === 'register' ? 'Sign up' : 'Continue';

  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color="#1f1f1f" />
      ) : (
        <View style={styles.row}>
          <GoogleMark />
          <Text style={styles.text}>
            {verb} with Google
          </Text>
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
