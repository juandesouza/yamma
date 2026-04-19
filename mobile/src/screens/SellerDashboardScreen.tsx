import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';

type MinePayload = {
  restaurant: { id: string; name: string } | null;
  menus: Array<{ id: string; name: string; items?: Array<{ id: string }> }>;
};

type OrderRow = {
  id: string;
  status: string;
  restaurantName?: string;
  deliveryAddress?: string;
  total?: string;
  currency?: string | null;
  courierRequestedAt?: string | null;
  createdAt?: string;
};

export default function SellerDashboardScreen() {
  const navigation = useNavigation();
  const { signOut, fetchAuthed } = useAuth();
  const [phase, setPhase] = useState<'loading' | 'setup' | 'orders'>('loading');
  const [mine, setMine] = useState<MinePayload | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mineRes = await fetchAuthed('/restaurants/mine');
    if (!mineRes.ok) {
      setPhase('setup');
      setMine(null);
      return;
    }
    const data = (await mineRes.json()) as MinePayload;
    setMine(data);
    const hasRestaurant = Boolean(data?.restaurant?.id);
    const hasMenuItems = Boolean(
      Array.isArray(data?.menus) &&
        data.menus.some((m) => Array.isArray(m.items) && m.items.length > 0),
    );
    if (hasRestaurant && hasMenuItems) {
      const oRes = await fetchAuthed('/orders/restaurant');
      if (oRes.ok) {
        const list = (await oRes.json()) as OrderRow[];
        setOrders(Array.isArray(list) ? list : []);
      } else {
        setOrders([]);
      }
      setPhase('orders');
    } else {
      setPhase('setup');
    }
  }, [fetchAuthed]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => signOut()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.headerLink}>Log out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, signOut]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase !== 'orders') return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [phase, load]);

  const dispatchOrder = useCallback(
    async (orderId: string) => {
      setDispatchingId(orderId);
      try {
        const res = await fetchAuthed(`/orders/${orderId}/dispatch`, { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        if (!res.ok) {
          const msg =
            typeof data.message === 'string'
              ? data.message
              : Array.isArray(data.message)
                ? data.message.join(', ')
                : 'Could not notify delivery.';
          Alert.alert('Dispatch failed', msg);
          return;
        }
        await load();
      } finally {
        setDispatchingId(null);
      }
    },
    [fetchAuthed, load],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ff5500" />
        <Text style={styles.muted}>Loading seller workspace…</Text>
      </View>
    );
  }

  if (phase === 'setup') {
    return (
      <ScrollableSetup
        refreshing={refreshing}
        onRefresh={onRefresh}
        mine={mine}
        onSignOut={signOut}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Orders</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff5500" />
        }
        ListEmptyComponent={<Text style={styles.muted}>No orders yet.</Text>}
        renderItem={({ item }) => {
          const canDispatch = item.status === 'confirmed' && !item.courierRequestedAt;
          const waitingDriver = item.status === 'confirmed' && Boolean(item.courierRequestedAt);
          return (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                <Text style={styles.orderStatus}>{item.status.replace(/_/g, ' ')}</Text>
              </View>
              {item.deliveryAddress ? <Text style={styles.orderAddress}>{item.deliveryAddress}</Text> : null}
              {item.total ? (
                <Text style={styles.orderSub}>
                  Total: {item.currency ?? 'USD'} {item.total}
                </Text>
              ) : null}
              {waitingDriver ? (
                <Text style={styles.orderHint}>
                  Waiting for a driver to accept (delivery partner notified).
                </Text>
              ) : null}
              <TouchableOpacity
                style={[styles.dispatchBtn, (!canDispatch || dispatchingId !== null) && styles.dispatchBtnDisabled]}
                onPress={() => void dispatchOrder(item.id)}
                disabled={!canDispatch || dispatchingId !== null}
                activeOpacity={0.85}
              >
                {dispatchingId === item.id ? (
                  <ActivityIndicator color="#0f1014" />
                ) : (
                  <Text style={styles.dispatchBtnText}>Ready and send to delivery</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

function ScrollableSetup({
  refreshing,
  onRefresh,
  mine,
  onSignOut,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  mine: MinePayload | null;
  onSignOut: () => void;
}) {
  return (
    <FlatList
      data={[1]}
      keyExtractor={() => 'setup'}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff5500" />
      }
      renderItem={() => (
        <View style={styles.setupBox}>
          <Text style={styles.setupTitle}>Set up your restaurant</Text>
          <Text style={styles.setupBody}>
            Add your place and menu on the web app (seller setup), then pull to refresh here. Seller guest accounts
            usually get a demo restaurant automatically—try refreshing.
          </Text>
          {mine?.restaurant?.id ? (
            <Text style={styles.setupHint}>
              Restaurant draft: {mine.restaurant.name}. Add menu items on the web to unlock orders here.
            </Text>
          ) : null}
          <TouchableOpacity style={styles.outlineBtn} onPress={onSignOut}>
            <Text style={styles.outlineBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1014', padding: 16 },
  centered: { flex: 1, backgroundColor: '#0f1014', justifyContent: 'center', alignItems: 'center', gap: 12 },
  heading: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 12 },
  muted: { color: '#7c7e8c', fontSize: 14, marginTop: 8 },
  headerLink: { color: '#ff5500', fontWeight: '600', fontSize: 16, marginRight: 8 },
  orderCard: {
    backgroundColor: '#1c1d23',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2c2d35',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  orderId: { color: '#fff', fontWeight: '600', fontSize: 16, flex: 1 },
  orderStatus: { color: '#ff9a66', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  orderAddress: { color: '#d1d5db', marginTop: 8, fontSize: 14, lineHeight: 20 },
  orderSub: { color: '#7c7e8c', marginTop: 6, fontSize: 13 },
  orderHint: { color: '#7c7e8c', marginTop: 8, fontSize: 12, lineHeight: 18 },
  dispatchBtn: {
    marginTop: 12,
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dispatchBtnDisabled: { opacity: 0.45 },
  dispatchBtnText: { color: '#0f1014', fontWeight: '700', fontSize: 15 },
  setupBox: { padding: 16, paddingTop: 24 },
  setupTitle: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 12 },
  setupBody: { fontSize: 15, color: '#9ca3af', lineHeight: 22, marginBottom: 16 },
  setupHint: { fontSize: 14, color: '#d1d5db', marginBottom: 24 },
  outlineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#40424d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  outlineBtnText: { color: '#ff5500', fontWeight: '600' },
});
