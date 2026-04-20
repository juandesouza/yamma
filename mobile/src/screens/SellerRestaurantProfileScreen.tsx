import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SellerStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { messageFromApiBody } from '../api/client';

type RestaurantRow = {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  cuisine?: string | null;
  imageUrl?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type MenuItemRow = { id: string; name: string; price: string };
type MinePayload = {
  restaurant: RestaurantRow | null;
  menus: Array<{ id: string; name: string; items?: MenuItemRow[] }>;
};

export default function SellerRestaurantProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SellerStackParamList, 'SellerRestaurantProfile'>>();
  const { fetchAuthed } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<MinePayload | null>(null);

  const [rName, setRName] = useState('');
  const [rCuisine, setRCuisine] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [rImageUrl, setRImageUrl] = useState('');
  const [rLat, setRLat] = useState('');
  const [rLng, setRLng] = useState('');

  const [itemName, setItemName] = useState('New dish');
  const [itemPrice, setItemPrice] = useState('12.99');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetchAuthed('/restaurants/mine');
    if (!res.ok) {
      setMine(null);
      return;
    }
    const data = (await res.json()) as MinePayload;
    setMine(data);
    if (data.restaurant) {
      setRName(data.restaurant.name ?? '');
      setRAddress(data.restaurant.address ?? '');
      setRCuisine(data.restaurant.cuisine ?? '');
      setRDescription(data.restaurant.description ?? '');
      setRImageUrl(data.restaurant.imageUrl ?? '');
      setRLat(data.restaurant.latitude != null ? String(data.restaurant.latitude) : '');
      setRLng(data.restaurant.longitude != null ? String(data.restaurant.longitude) : '');
    }
  }, [fetchAuthed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function onCreateRestaurant() {
    const lat = parseFloat(rLat);
    const lng = parseFloat(rLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Coordinates', 'Enter valid latitude and longitude (numbers).');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchAuthed('/restaurants/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rName.trim(),
          cuisine: rCuisine.trim() || undefined,
          address: rAddress.trim(),
          description: rDescription.trim() || undefined,
          imageUrl: rImageUrl.trim() || undefined,
          latitude: lat,
          longitude: lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Could not create', messageFromApiBody(data) ?? `HTTP ${res.status}`);
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onSaveRestaurant() {
    const lat = parseFloat(rLat);
    const lng = parseFloat(rLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Coordinates', 'Enter valid latitude and longitude.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchAuthed('/restaurants/mine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rName.trim(),
          address: rAddress.trim(),
          cuisine: rCuisine.trim() || undefined,
          description: rDescription.trim() || undefined,
          imageUrl: rImageUrl.trim() || undefined,
          latitude: lat,
          longitude: lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Could not save', messageFromApiBody(data) ?? `HTTP ${res.status}`);
        return;
      }
      Alert.alert('Saved', 'Restaurant profile updated.');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onAddItem() {
    const price = parseFloat(itemPrice);
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('Price', 'Enter a valid price.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetchAuthed('/restaurants/mine/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: itemName.trim(), price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Could not add item', messageFromApiBody(data) ?? `HTTP ${res.status}`);
        return;
      }
      setItemName('New dish');
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ff5500" />
        <Text style={styles.muted}>Loading restaurant…</Text>
      </View>
    );
  }

  const restaurant = mine?.restaurant;
  const allItems =
    mine?.menus?.flatMap((m) => (Array.isArray(m.items) ? m.items.map((it) => ({ ...it, menuName: m.name })) : [])) ??
    [];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Restaurant profile</Text>
      <Text style={styles.sub}>Update your listing, coordinates, and menu. Matches the web seller profile.</Text>

      {!restaurant ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create your restaurant</Text>
          <Field label="Name" value={rName} onChangeText={setRName} />
          <Field label="Cuisine (optional)" value={rCuisine} onChangeText={setRCuisine} />
          <Field label="Street address" value={rAddress} onChangeText={setRAddress} multiline />
          <Field label="Latitude" value={rLat} onChangeText={setRLat} keyboardType="decimal-pad" />
          <Field label="Longitude" value={rLng} onChangeText={setRLng} keyboardType="decimal-pad" />
          <Field label="Description (optional)" value={rDescription} onChangeText={setRDescription} multiline />
          <Field label="Image URL (optional)" value={rImageUrl} onChangeText={setRImageUrl} />
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={() => void onCreateRestaurant()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#0f1014" /> : <Text style={styles.primaryBtnText}>Create restaurant</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit restaurant</Text>
            <Field label="Name" value={rName} onChangeText={setRName} />
            <Field label="Cuisine (optional)" value={rCuisine} onChangeText={setRCuisine} />
            <Field label="Address" value={rAddress} onChangeText={setRAddress} multiline />
            <Field label="Latitude" value={rLat} onChangeText={setRLat} keyboardType="decimal-pad" />
            <Field label="Longitude" value={rLng} onChangeText={setRLng} keyboardType="decimal-pad" />
            <Field label="Description (optional)" value={rDescription} onChangeText={setRDescription} multiline />
            <Field label="Image URL (optional)" value={rImageUrl} onChangeText={setRImageUrl} />
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.btnDisabled]}
              onPress={() => void onSaveRestaurant()}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#0f1014" /> : <Text style={styles.primaryBtnText}>Save restaurant</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Menu ({allItems.length} items)</Text>
            {allItems.length === 0 ? (
              <Text style={styles.muted}>No dishes yet — add one below.</Text>
            ) : (
              allItems.map((it) => (
                <View key={it.id} style={styles.menuRow}>
                  <Text style={styles.menuName}>{it.name}</Text>
                  <Text style={styles.menuPrice}>
                    {it.menuName ? `${it.menuName} · ` : ''}${it.price} USD
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.sectionLabel}>Add menu item</Text>
            <Field label="Dish name" value={itemName} onChangeText={setItemName} />
            <Field label="Price (USD)" value={itemPrice} onChangeText={setItemPrice} keyboardType="decimal-pad" />
            <TouchableOpacity
              style={[styles.secondaryBtn, adding && styles.btnDisabled]}
              onPress={() => void onAddItem()}
              disabled={adding}
            >
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryBtnText}>Add dish</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Text style={styles.backBtnText}>← Back to orders</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#676a77"
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: '#0f1014' },
  centered: { flex: 1, backgroundColor: '#0f1014', justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub: { fontSize: 14, color: '#9ca3af', lineHeight: 20, marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#14151a',
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#fff', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#3d3f4a',
    backgroundColor: '#17181d',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#ff5500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f1014', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ff5500',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#ff5500', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2d35',
  },
  menuName: { color: '#e5e7eb', flex: 1, fontSize: 15 },
  menuPrice: { color: '#9ca3af', fontSize: 13 },
  sectionLabel: { color: '#fff', fontWeight: '600', marginTop: 16, marginBottom: 8, fontSize: 15 },
  muted: { color: '#7c7e8c', fontSize: 14 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 12 },
  backBtnText: { color: '#ff5500', fontWeight: '600', fontSize: 16 },
});
