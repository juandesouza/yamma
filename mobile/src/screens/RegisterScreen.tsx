import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const { registerAccount } = useAuth();
  const [accountType, setAccountType] = useState<'buyer' | 'seller'>('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    setSuccess('');
    const nameTrim = name.trim();
    const emailTrim = email.trim().toLowerCase();
    if (nameTrim.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!emailTrim.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { ok, message } = await registerAccount({
        name: nameTrim,
        email: emailTrim,
        password,
        accountType,
      });
      if (!ok) {
        const msg = message ?? 'Registration failed';
        setError(msg);
        Alert.alert('Sign up failed', msg);
        return;
      }
      setSuccess('Account created. You can log in now.');
      setTimeout(() => {
        navigation.navigate('Login', { registered: true });
      }, 900);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      Alert.alert('Sign up failed', msg);
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
        <Text style={styles.title}>Sign up</Text>
        <Text style={styles.label}>I want to use Yamma to</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeCard, accountType === 'buyer' && styles.typeCardActive]}
            onPress={() => setAccountType('buyer')}
            activeOpacity={0.9}
          >
            <Text style={styles.typeEmoji}>🍽️</Text>
            <Text style={[styles.typeTitle, accountType === 'buyer' && styles.typeTitleActive]}>Buy food</Text>
            <Text style={[styles.typeHint, accountType === 'buyer' && styles.typeHintActive]}>
              Order from restaurants
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeCard, accountType === 'seller' && styles.typeCardActive]}
            onPress={() => setAccountType('seller')}
            activeOpacity={0.9}
          >
            <Text style={styles.typeEmoji}>🏪</Text>
            <Text style={[styles.typeTitle, accountType === 'seller' && styles.typeTitleActive]}>Sell food</Text>
            <Text style={[styles.typeHint, accountType === 'seller' && styles.typeHintActive]}>
              Manage restaurant orders
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#5c5e6b"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
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
          placeholder="At least 8 characters"
          placeholderTextColor="#5c5e6b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.fieldLabel}>Confirm password</Text>
        <TextInput
          style={styles.input}
          placeholder="Repeat password"
          placeholderTextColor="#5c5e6b"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create account</Text>}
        </TouchableOpacity>

        <Text style={styles.or}>or</Text>
        <GoogleSignInButton disabled={loading} variant="register" />

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
          <Text style={styles.linkMuted}>
            Already have an account? <Text style={styles.link}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f1014' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 20 },
  label: { fontSize: 14, color: '#9ca3af', marginBottom: 10 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#1c1d23',
  },
  typeCardActive: { borderColor: '#ff5500', backgroundColor: '#2a1a12' },
  typeEmoji: { fontSize: 20, marginBottom: 6 },
  typeTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  typeTitleActive: { color: '#fff' },
  typeHint: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  typeHintActive: { color: 'rgba(255,255,255,0.75)' },
  fieldLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#2c2d35',
    borderWidth: 1,
    borderColor: '#40424d',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    marginBottom: 4,
  },
  error: { color: '#ef4444', marginTop: 8, fontSize: 14 },
  success: { color: '#22c55e', marginTop: 8, fontSize: 14 },
  submit: {
    backgroundColor: '#ff5500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  linkMuted: { color: '#6b7280', fontSize: 14 },
  link: { color: '#ff5500', fontWeight: '600' },
  or: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginTop: 8, marginBottom: 12 },
});
