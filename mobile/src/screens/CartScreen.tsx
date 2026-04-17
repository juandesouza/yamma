import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import {
  cartSubtotal,
  decrementCartLine,
  incrementCartLine,
  loadCart,
  removeCartLine,
  type CartLine,
} from '../lib/cart';

export default function CartScreen() {
  const route = useRoute<RouteProp<{ params: { restaurantId: string } }, 'params'>>();
  const restaurantId = route.params?.restaurantId ?? '';
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Cart'>>();
  const [items, setItems] = useState<CartLine[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const rows = await loadCart(restaurantId);
        if (!cancelled) setItems(rows);
      })();
      return () => {
        cancelled = true;
      };
    }, [restaurantId]),
  );

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const deliveryFee = subtotal > 0 && subtotal < 30 ? 5 : 0;
  const total = subtotal + deliveryFee;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  async function onIncrement(menuItemId: string) {
    const rows = await incrementCartLine(restaurantId, menuItemId);
    setItems(rows);
  }

  async function onDecrement(menuItemId: string) {
    const rows = await decrementCartLine(restaurantId, menuItemId);
    setItems(rows);
  }

  async function onRemove(menuItemId: string) {
    const rows = await removeCartLine(restaurantId, menuItemId);
    setItems(rows);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your cart</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>Cart is empty. Add dishes from the restaurant menu.</Text>
      ) : (
        <View style={styles.card}>
          {items.map((row) => (
            <View key={row.menuItemId} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowText}>{row.name}</Text>
                <Text style={styles.rowPrice}>{fmt(row.quantity * Number(row.unitPrice))}</Text>
              </View>
              <View style={styles.controlsRow}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => void onDecrement(row.menuItemId)} activeOpacity={0.8}>
                  <Text style={styles.controlText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{row.quantity}</Text>
                <TouchableOpacity style={styles.controlBtn} onPress={() => void onIncrement(row.menuItemId)} activeOpacity={0.8}>
                  <Text style={styles.controlText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => void onRemove(row.menuItemId)} activeOpacity={0.8}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.sep} />
          <View style={styles.row}><Text style={styles.muted}>Subtotal</Text><Text style={styles.muted}>{fmt(subtotal)}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Delivery</Text><Text style={styles.muted}>{fmt(deliveryFee)}</Text></View>
          <View style={styles.row}><Text style={styles.total}>Total</Text><Text style={styles.total}>{fmt(total)}</Text></View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, items.length === 0 && styles.buttonDisabled]}
        onPress={() => navigation.navigate('Checkout', { restaurantId })}
        disabled={items.length === 0}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>Proceed to checkout</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkWrap}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.linkText}>Continue shopping</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 36, backgroundColor: '#0f1014', flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8 },
  muted: { color: '#7c7e8c' },
  card: {
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 14,
    backgroundColor: '#1b1c22',
    padding: 12,
    marginBottom: 16,
    marginTop: 6,
  },
  row: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2b2e38',
    paddingBottom: 10,
  },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  rowText: { color: '#fff', flex: 1 },
  rowPrice: { color: '#ff9a66', fontWeight: '600' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d3f4a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17181d',
  },
  controlText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  qtyText: { color: '#fff', minWidth: 16, textAlign: 'center', fontWeight: '600' },
  removeBtn: {
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#56323a',
    backgroundColor: '#2a171d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeText: { color: '#fda4af', fontWeight: '600', fontSize: 12 },
  sep: { height: 1, backgroundColor: '#2e313d', marginVertical: 8 },
  total: { color: '#fff', fontWeight: '700', fontSize: 16 },
  button: { backgroundColor: '#ff5500', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '600' },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#9ca3af', textDecorationLine: 'underline' },
});
