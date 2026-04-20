import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import { API_BASE_URL, ngrokFetchHeaders } from '../config/api';
import { addCartLine, cartLineCount } from '../lib/cart';

type Params = { restaurantId: string };

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: string | number;
};

type MenuSection = {
  id: string;
  name: string;
  items?: MenuItem[];
};

type Restaurant = {
  id: string;
  name: string;
  description?: string | null;
  cuisine?: string | null;
  imageUrl?: string | null;
};

export default function RestaurantScreen() {
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Restaurant'>>();
  const id = route.params?.restaurantId ?? '';

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rRes, mRes] = await Promise.all([
          fetch(`${API_BASE_URL}/restaurants/${id}`, { headers: ngrokFetchHeaders() }),
          fetch(`${API_BASE_URL}/restaurants/${id}/menus`, { headers: ngrokFetchHeaders() }),
        ]);

        if (!cancelled && rRes.ok) {
          const raw = await rRes.json();
          const r = (raw && typeof raw === 'object' && 'error' in raw) ? null : (raw as Restaurant);
          setRestaurant(r);
        }
        if (!cancelled && mRes.ok) {
          const m = await mRes.json();
          setMenus(Array.isArray(m) ? (m as MenuSection[]) : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        const n = await cartLineCount(id);
        if (!cancelled) setCartCount(n);
      })();
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const dishes = useMemo(() => {
    const rows: Array<MenuItem & { section: string }> = [];
    for (const section of menus) {
      for (const item of section.items ?? []) {
        rows.push({ ...item, section: section.name });
      }
    }
    return rows;
  }, [menus]);

  return (
    <View style={styles.container}>
      <FlatList
        data={dishes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {restaurant?.imageUrl ? (
              <Image source={{ uri: restaurant.imageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
            <Text style={styles.title}>{restaurant?.name ?? 'Restaurant'}</Text>
            <Text style={styles.subtitle}>
              {restaurant?.cuisine ?? 'Cuisine unavailable'}
              {restaurant?.description ? ` · ${restaurant.description}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => navigation.navigate('Cart', { restaurantId: id })}
              activeOpacity={0.9}
            >
              <Text style={styles.cartButtonText}>
                View cart & checkout
                {cartCount > 0 ? ` (${cartCount})` : ''}
              </Text>
            </TouchableOpacity>
            <Text style={styles.sectionHeader}>Dishes</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
            ) : (
              <View style={styles.itemImagePlaceholder} />
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSection}>{item.section}</Text>
              {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
              <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  addingItemId === item.id && styles.addButtonPending,
                  addedItemId === item.id && styles.addButtonSuccess,
                ]}
                activeOpacity={0.9}
                onPress={async () => {
                  try {
                    setAddingItemId(item.id);
                    const unitPrice = Number(item.price).toFixed(2);
                    const nextCount = await addCartLine(id, {
                      menuItemId: item.id,
                      name: item.name,
                      unitPrice,
                    });
                    setCartCount(nextCount);
                    setAddedItemId(item.id);
                    setTimeout(() => {
                      setAddedItemId((prev) => (prev === item.id ? null : prev));
                    }, 900);
                  } catch (e) {
                    Alert.alert('Could not add to cart', e instanceof Error ? e.message : 'Try again');
                  } finally {
                    setAddingItemId((prev) => (prev === item.id ? null : prev));
                  }
                }}
              >
                <Text style={styles.addButtonText}>
                  {addingItemId === item.id
                    ? 'Adding...'
                    : addedItemId === item.id
                      ? 'Added ✓'
                      : 'Add to cart'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color="#ff5500" />
            </View>
          ) : (
            <Text style={styles.emptyText}>No dishes available for this restaurant yet.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1014', paddingHorizontal: 16 },
  heroImage: { height: 170, borderRadius: 14, marginTop: 12, marginBottom: 12, backgroundColor: '#2c2d35' },
  heroPlaceholder: { height: 170, borderRadius: 14, marginTop: 12, marginBottom: 12, backgroundColor: '#2c2d35' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitle: { color: '#9ca3af', marginBottom: 16, lineHeight: 18 },
  cartButton: {
    backgroundColor: '#ff5500',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  cartButtonText: { color: '#fff', fontWeight: '700' },
  sectionHeader: { color: '#e5e7eb', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  itemCard: {
    backgroundColor: '#1c1d23',
    borderWidth: 1,
    borderColor: '#2c2d35',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  itemImage: { height: 130, width: '100%', backgroundColor: '#2c2d35' },
  itemImagePlaceholder: { height: 130, width: '100%', backgroundColor: '#2c2d35' },
  itemBody: { padding: 12 },
  itemName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  itemSection: { color: '#7c7e8c', fontSize: 12, marginTop: 2 },
  itemDescription: { color: '#c7cad4', fontSize: 14, marginTop: 8, lineHeight: 18 },
  itemPrice: { color: '#ff5500', fontSize: 17, fontWeight: '700', marginTop: 10 },
  addButton: {
    marginTop: 12,
    backgroundColor: '#2a2b31',
    borderWidth: 1,
    borderColor: '#40424d',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addButtonPending: { opacity: 0.8 },
  addButtonSuccess: {
    backgroundColor: '#1f3a2e',
    borderColor: '#22c55e',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  emptyWrap: { paddingVertical: 24 },
  emptyText: { color: '#7c7e8c', textAlign: 'center', marginTop: 20, marginBottom: 20 },
});
