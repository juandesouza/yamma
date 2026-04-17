import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<AuthStackParamList, 'Login'>>();
  const registered = route.params?.registered === true;
  const { loginWithEmail, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);


  async function handleForgotPassword() {
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Missing email', 'Enter your recovery email first.');
      return;
    }

    setResetLoading(true);
    try {
      const { ok, message } = await requestPasswordReset(normalizedEmail);
      if (!ok) {
        Alert.alert('Recovery unavailable', message ?? 'Could not start password reset.');
      } else {
        setForgotEmail('');
        setShowForgot(false);
        Alert.alert(
          'Check your email',
          message ?? 'If this account exists, we sent a reset link.',
        );
      }
    } catch {
      Alert.alert('Recovery unavailable', 'Could not start password reset. Try again.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const { ok, message } = await loginWithEmail(email.trim().toLowerCase(), password);
      if (!ok) {
        const msg = message ?? 'Login failed';
        setError(msg);
        Alert.alert('Log in failed', msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      Alert.alert('Log in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log in</Text>
        {registered ? (
          <Text style={styles.registeredHint}>You can now log in with your new account.</Text>
        ) : null}
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#5c5e6b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#5c5e6b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          onPress={() => {
            setShowForgot((v) => !v);
            setError('');
          }}
          style={styles.forgotWrap}
          activeOpacity={0.8}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
        {showForgot ? (
          <View style={styles.forgotCard}>
            <Text style={styles.fieldLabel}>Recovery email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#5c5e6b"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.resetButton, resetLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={resetLoading}
              activeOpacity={0.9}
            >
              {resetLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send reset link</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
        </TouchableOpacity>

        <Text style={styles.or}>or</Text>
        <GoogleSignInButton disabled={loading} variant="login" />

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
          <Text style={styles.linkMuted}>
            Don&apos;t have an account? <Text style={styles.link}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f1014' },
  scroll: { padding: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 12 },
  registeredHint: { fontSize: 14, color: '#22c55e', marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 6 },
  input: {
    backgroundColor: '#2c2d35',
    borderWidth: 1,
    borderColor: '#40424d',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    marginBottom: 12,
  },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 8 },
  forgotText: { color: '#ff9a66', fontSize: 13, fontWeight: '500' },
  forgotCard: {
    backgroundColor: '#17181d',
    borderWidth: 1,
    borderColor: '#3d3f4a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  resetButton: { backgroundColor: '#ff5500', padding: 12, borderRadius: 10, alignItems: 'center' },
  error: { color: '#ef4444', marginBottom: 8, fontSize: 14 },
  button: { backgroundColor: '#ff5500', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  or: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginTop: 16, marginBottom: 12 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  linkMuted: { color: '#6b7280', fontSize: 14 },
  link: { color: '#ff5500', fontWeight: '600' },
});
