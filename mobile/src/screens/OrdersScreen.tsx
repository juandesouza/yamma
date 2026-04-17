import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';

type OrderRow = {
  id: string;
  status: string;
  total: string;
  currency?: string | null;
  createdAt?: string;
};

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Orders'>>();
  const { fetchAuthed } = useAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchAuthed('/orders');
    if (!res.ok) {
      setRows([]);
      return;
    }
    const data = (await res.json().catch(() => [])) as OrderRow[];
    setRows(Array.isArray(data) ? data : []);
  }, [fetchAuthed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const fmtTotal = (o: OrderRow) => {
    const n = Number(o.total);
    const cur = o.currency ?? 'USD';
    if (!Number.isFinite(n)) return o.total;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <View style={styles.wrap}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#ff5500" size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff5500" />}
          ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.rowTop}>
                <Text style={styles.rowId}>#{item.id.slice(0, 8)}</Text>
                <Text style={styles.rowStatus}>{item.status}</Text>
              </View>
              <Text style={styles.rowMeta}>
                {fmtTotal(item)}
                {item.createdAt ? ` · ${fmtDate(item.createdAt)}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.listPad}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0f1014' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listPad: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#7c7e8c', padding: 24 },
  row: {
    backgroundColor: '#1c1d23',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2c2d35',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowId: { color: '#fff', fontWeight: '600', fontSize: 16 },
  rowStatus: { color: '#ff9a66', fontSize: 14, textTransform: 'capitalize' },
  rowMeta: { color: '#7c7e8c', fontSize: 13 },
});
