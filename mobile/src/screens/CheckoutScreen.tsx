import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import {
  cartSubtotal,
  clearCart,
  loadCart,
  loadSavedDelivery,
  saveDelivery,
  type CartLine,
} from '../lib/cart';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../config/api';

type CheckoutStep = 'address' | 'payment';

type GeoCoords = { lat: number; lng: number };

type GeoResult = {
  address: string;
  latitude: number;
  longitude: number;
  placeName?: string;
};

export default function CheckoutScreen() {
  const route = useRoute<RouteProp<{ params: { restaurantId: string } }, 'params'>>();
  const restaurantId = route.params?.restaurantId ?? '';
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Checkout'>>();
  const { fetchAuthed, user } = useAuth();

  const [items, setItems] = useState<CartLine[]>([]);
  const [step, setStep] = useState<CheckoutStep>('address');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<GeoResult[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState('');
  const geocodeSeq = useRef(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rows, saved] = await Promise.all([loadCart(restaurantId), loadSavedDelivery(user?.id)]);
      if (!cancelled) {
        setItems(rows);
        setAddress(saved.address);
        if (
          typeof saved.lat === 'number' &&
          typeof saved.lng === 'number' &&
          Number.isFinite(saved.lat) &&
          Number.isFinite(saved.lng)
        ) {
          setCoords({ lat: saved.lat, lng: saved.lng });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, user?.id]);

  useEffect(() => {
    const q = address.trim();
    if (q.length < 5) {
      setAddressSuggestions([]);
      setSearchingAddress(false);
      return;
    }
    const timer = setTimeout(async () => {
      const seq = ++geocodeSeq.current;
      setSearchingAddress(true);
      setAddressLookupError('');
      try {
        const res = await fetch(
          `${API_BASE_URL}/mapbox/geocode?q=${encodeURIComponent(q)}&limit=6`,
        );
        const data = await res.json().catch(() => []);
        if (seq !== geocodeSeq.current) return;
        if (!res.ok || !Array.isArray(data)) {
          setAddressSuggestions([]);
          return;
        }
        setAddressSuggestions(data as GeoResult[]);
      } catch {
        if (seq !== geocodeSeq.current) return;
        setAddressSuggestions([]);
        setAddressLookupError('Could not search addresses right now.');
      } finally {
        if (seq === geocodeSeq.current) setSearchingAddress(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [address]);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const deliveryFee = subtotal > 0 && subtotal < 30 ? 5 : 0;
  const total = subtotal + deliveryFee;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const createOrder = useCallback(async (): Promise<string | null> => {
    if (items.length === 0) {
      Alert.alert('Empty cart', 'Add dishes before checkout.');
      return null;
    }
    if (!address.trim()) {
      Alert.alert('Missing address', 'Enter your delivery address.');
      return null;
    }
    if (!coords) {
      Alert.alert(
        'Pick an address',
        'Choose one of the suggestions from the list so we can pin your location on the map.',
      );
      return null;
    }
    setBusy(true);
    try {
      await saveDelivery({ address: address.trim(), lat: coords.lat, lng: coords.lng }, user?.id);
      const res = await fetchAuthed('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          deliveryAddress: address.trim(),
          deliveryLatitude: coords.lat,
          deliveryLongitude: coords.lng,
          items: items.map((r) => ({
            menuItemId: r.menuItemId,
            quantity: r.quantity,
            name: r.name,
            unitPrice: r.unitPrice,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string | string[] };
      if (!res.ok || !data.id) {
        const msg =
          typeof data.message === 'string'
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join(', ')
              : 'Could not create order.';
        Alert.alert('Checkout failed', msg);
        return null;
      }
      setOrderId(data.id);
      return data.id;
    } finally {
      setBusy(false);
    }
  }, [address, coords, fetchAuthed, items, restaurantId, user?.id]);

  async function handleProceedToPayment() {
    const oid = await createOrder();
    if (oid) {
      setStep('payment');
    }
  }

  async function waitForOrderConfirmation(oid: string): Promise<boolean> {
    const maxPolls = 90;
    for (let poll = 0; poll < maxPolls; poll++) {
      const res = await fetchAuthed(`/orders/${oid}`);
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      if (res.ok && data.status && data.status !== 'pending') {
        await clearCart(restaurantId);
        navigation.replace('OrderTracking', { orderId: oid });
        return true;
      }
      if (__DEV__ && poll >= 3) {
        await fetchAuthed('/payments/dev/confirm-lemon-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: oid }),
        });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  async function handlePayWithLemon() {
    if (!orderId) {
      Alert.alert('Order missing', 'Create order first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetchAuthed('/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          provider: 'lemon_squeeze',
          checkoutSuccessTarget: 'mobile',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        successRedirectUrl?: string;
        message?: string | string[];
      };
      if (!res.ok) {
        const msg =
          typeof data.message === 'string'
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join(', ')
              : 'Could not start payment.';
        Alert.alert('Payment failed', msg);
        return;
      }
      const checkoutUrl = data.checkoutUrl;
      const successRedirectUrl = data.successRedirectUrl;
      if (!checkoutUrl || !successRedirectUrl) {
        Alert.alert('Payment failed', 'Missing checkout or return URL from server.');
        return;
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(checkoutUrl, successRedirectUrl);

      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
        Alert.alert(
          'Checkout closed',
          'If you already paid, open Profile → Orders to see your order status.',
        );
        return;
      }

      // `success` = redirect URL was captured. `opened` can occur on Android when the tab closes without a parsed redirect.
      if (browserResult.type === 'success' || browserResult.type === 'opened') {
        const ok = await waitForOrderConfirmation(orderId);
        if (!ok) {
          Alert.alert(
            'Still confirming',
            'We could not confirm payment yet. Open Profile → Orders to check status, or try again in a moment.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Checkout</Text>
      <View style={styles.summary}>
        <View style={styles.row}><Text style={styles.muted}>Subtotal</Text><Text style={styles.muted}>{fmt(subtotal)}</Text></View>
        <View style={styles.row}><Text style={styles.muted}>Delivery</Text><Text style={styles.muted}>{fmt(deliveryFee)}</Text></View>
        <View style={styles.row}><Text style={styles.total}>Total</Text><Text style={styles.total}>{fmt(total)}</Text></View>
      </View>

      {step === 'address' ? (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Delivery address</Text>
            {searchingAddress ? <ActivityIndicator size="small" color="#9ca3af" /> : null}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Street, number, neighborhood"
            placeholderTextColor="#676a77"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setCoords(null);
            }}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {addressLookupError ? <Text style={styles.addrError}>{addressLookupError}</Text> : null}
          {addressSuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {addressSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={`${s.latitude},${s.longitude},${i}`}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setAddress(s.address);
                    setCoords({ lat: s.latitude, lng: s.longitude });
                    setAddressSuggestions([]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText} numberOfLines={3}>
                    {s.placeName?.trim() ? s.placeName : s.address}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Text style={styles.help}>
            {coords
              ? 'Location pinned. Edit the text to search again.'
              : 'Type at least 5 characters, then pick a suggestion to pin your location.'}
            {' '}We save this for your next checkout.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={() => void handleProceedToPayment()}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Proceed to payment</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Payment method</Text>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Card - Lemon Squeezy</Text>
            <Text style={styles.help}>
              Pay securely in the browser. When payment completes, you return to the app and we open your order status.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={() => void handlePayWithLemon()}
              disabled={busy}
              activeOpacity={0.9}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Pay with Lemon Squeezy</Text>}
            </TouchableOpacity>
          </View>
          {orderId ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('OrderTracking', { orderId })}
              activeOpacity={0.85}
              style={styles.inlineLinkWrap}
            >
              <Text style={styles.inlineLink}>View this order’s status</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, backgroundColor: '#0f1014', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 12 },
  summary: {
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 14,
    backgroundColor: '#1b1c22',
    padding: 12,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  muted: { color: '#9ca3af' },
  total: { color: '#fff', fontWeight: '700', fontSize: 16 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 6,
  },
  label: { color: '#d1d5db', fontSize: 13 },
  addrError: { color: '#f87171', fontSize: 12, marginTop: 6 },
  suggestions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3d3f4a',
    borderRadius: 12,
    backgroundColor: '#17181d',
    maxHeight: 220,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2d35',
  },
  suggestionText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#3d3f4a',
    backgroundColor: '#17181d',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  help: { color: '#7c7e8c', marginTop: 8, fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 14,
    backgroundColor: '#1b1c22',
    padding: 12,
    marginBottom: 10,
  },
  paymentTitle: { color: '#fff', fontWeight: '600', marginBottom: 2 },
  primaryButton: {
    backgroundColor: '#ff5500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  inlineLinkWrap: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  inlineLink: { color: '#ff9a66', fontWeight: '600', fontSize: 15 },
  buttonDisabled: { opacity: 0.65 },
});
