import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';

type Params = { orderId: string };

export default function OrderTrackingScreen() {
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const orderId = route.params?.orderId ?? '';
  const { fetchAuthed } = useAuth();
  const [status, setStatus] = useState<string>('…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetchAuthed(`/orders/${orderId}`);
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { status?: string };
        setStatus(data.status ?? 'pending');
      } catch {
        if (!cancelled) setStatus('unknown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void poll();
    interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [orderId, fetchAuthed]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order #{orderId.slice(0, 8)}</Text>
      {loading ? (
        <ActivityIndicator color="#ff5500" style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      <Text style={styles.muted}>Status updates every few seconds while this screen is open.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1014', padding: 16 },
  title: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 12 },
  statusBadge: { backgroundColor: '#1c1d23', padding: 16, borderRadius: 12, marginBottom: 16 },
  statusText: { color: '#ff5500', fontSize: 18, textTransform: 'capitalize' },
  muted: { color: '#7c7e8c' },
});
