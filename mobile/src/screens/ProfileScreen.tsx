import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Profile'>>();
  const { user, signOut } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Profile</Text>
        <Text style={styles.name}>{user?.name ?? 'Guest'}</Text>
        <Text style={styles.email}>{user?.email?.trim() ? user.email : 'No email on file'}</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('Orders')}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryBtnText}>Orders</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>View past orders and check payment status.</Text>

      <View style={styles.accountSection}>
        <Text style={styles.accountTitle}>Account</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => void signOut()} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, backgroundColor: '#0f1014', flexGrow: 1 },
  card: {
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 16,
    backgroundColor: '#1b1c22',
    padding: 16,
    marginBottom: 20,
  },
  kicker: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 26, fontWeight: '700', color: '#fff', marginTop: 8 },
  email: { fontSize: 14, color: '#7c7e8c', marginTop: 8 },
  primaryBtn: {
    backgroundColor: '#ff5500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: '#7c7e8c', fontSize: 12, marginTop: 10, lineHeight: 18 },
  accountSection: { marginTop: 32 },
  accountTitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: '#7c7e8c',
    marginBottom: 12,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#3d3f4a',
    backgroundColor: '#17181d',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryBtnText: { color: '#e5e7eb', fontWeight: '600', fontSize: 16 },
});
