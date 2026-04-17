import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: Props) {
  const { guestSession } = useAuth();
  const [busy, setBusy] = useState<'buyer' | 'seller' | null>(null);

  async function onGuest(role: 'buyer' | 'seller') {
    setBusy(role);
    try {
      const { ok, message } = await guestSession(role);
      if (!ok) {
        Alert.alert('Guest sign-in failed', message ?? 'Try again or use email.');
      }
    } catch (e) {
      Alert.alert('Guest sign-in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome to Yamma</Text>
        <Text style={styles.subtitle}>
          Sign in to see restaurants near you, or enter as a guest to browse without an account.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>Log in with email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryBtnText}>Sign up with email</Text>
        </TouchableOpacity>

        <Text style={styles.or}>or</Text>
        <GoogleSignInButton disabled={busy !== null} variant="login" />

        <Text style={styles.guestIntro}>If you want to try the app without signing up, choose a guest mode</Text>

        <TouchableOpacity
          style={[styles.guestBtn, busy === 'buyer' && styles.guestBtnDisabled]}
          onPress={() => onGuest('buyer')}
          disabled={busy !== null}
          activeOpacity={0.9}
        >
          {busy === 'buyer' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.guestBtnText}>Enter as buyer guest</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.guestBtnOutline, busy === 'seller' && styles.guestBtnDisabled]}
          onPress={() => onGuest('seller')}
          disabled={busy !== null}
          activeOpacity={0.9}
        >
          {busy === 'seller' ? (
            <ActivityIndicator color="#ff5500" />
          ) : (
            <Text style={styles.guestBtnOutlineText}>Enter as seller guest</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: '#0f1014', paddingHorizontal: 20, paddingVertical: 24 },
  inner: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#9ca3af', lineHeight: 22, marginBottom: 24 },
  primaryBtn: {
    backgroundColor: '#ff5500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#3d3f4a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#1c1d23',
  },
  secondaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  or: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 12 },
  guestIntro: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 20, marginBottom: 12 },
  guestBtn: {
    backgroundColor: '#2c2d35',
    borderWidth: 1,
    borderColor: '#40424d',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  guestBtnDisabled: { opacity: 0.7 },
  guestBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  guestBtnOutline: {
    borderWidth: 1,
    borderColor: '#40424d',
    backgroundColor: '#1c1d23',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  guestBtnOutlineText: { color: '#d1d5db', fontWeight: '600', fontSize: 16 },
});
