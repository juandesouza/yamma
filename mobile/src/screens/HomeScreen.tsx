import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BuyerStackParamList } from '../navigation/types';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../auth/AuthContext';

const DEFAULT_LAT = 38.9072;
const DEFAULT_LNG = -77.0369;
const PAGE_SIZE = 10;

type RestaurantCard = {
  id: string;
  name: string;
  cuisine?: string;
  distance?: string;
  imageUrl?: string | null;
};

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BuyerStackParamList, 'Home'>>();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingFirstPage, setLoadingFirstPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('Profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Profile and settings"
        >
          <Ionicons name="person-circle-outline" size={28} color="#ff5500" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchPage = useCallback(async (nextOffset: number, mode: 'refresh' | 'append' | 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (mode === 'append') {
      setLoadingMore(true);
    } else {
      setLoadingFirstPage(true);
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/restaurants?lat=${DEFAULT_LAT}&lng=${DEFAULT_LNG}&limit=${PAGE_SIZE}&offset=${nextOffset}`,
      );
      if (!res.ok) return;

      const payload = await res.json();
      const page = (Array.isArray(payload) ? payload : []) as RestaurantCard[];

      setHasMore(page.length === PAGE_SIZE);
      setOffset(nextOffset + page.length);

      if (nextOffset === 0) {
        setRestaurants(page);
      } else {
        setRestaurants((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const merged = [...prev];
          for (const r of page) {
            if (!seen.has(r.id)) merged.push(r);
          }
          return merged;
        });
      }
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
      setLoadingFirstPage(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(0, 'initial');
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setHasMore(true);
    setOffset(0);
    void fetchPage(0, 'refresh');
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || refreshing || loadingFirstPage) return;
    void fetchPage(offset, 'append');
  }, [fetchPage, hasMore, loadingMore, offset, refreshing, loadingFirstPage]);

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Text style={styles.screenTitle}>Restaurants near you</Text>
        <Text style={styles.screenSubtitle}>
          Signed in as <Text style={styles.screenSubtitleStrong}>{user?.name ?? 'Guest'}</Text>. We list places nearest
          first; distance is in miles.
        </Text>
      </View>
    ),
    [user?.name],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff5500" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Restaurant', { restaurantId: item.id })}
            activeOpacity={0.9}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={styles.cardImagePlaceholder} />
            )}
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>
              {item.cuisine ?? 'Cuisine unavailable'}{item.distance ? ` · ${item.distance}` : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loadingFirstPage && !refreshing ? <Text style={styles.empty}>No restaurants nearby</Text> : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#ff5500" />
            </View>
          ) : null
        }
      />
      {loadingFirstPage ? (
        <View style={styles.firstLoadOverlay}>
          <ActivityIndicator color="#ff5500" size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1014' },
  headerBlock: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  screenTitle: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8 },
  screenSubtitle: { fontSize: 14, color: '#9ca3af', lineHeight: 20 },
  screenSubtitleStrong: { color: '#e5e7eb', fontWeight: '600' },
  headerIconBtn: { marginRight: 4 },
  card: {
    backgroundColor: '#1c1d23',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2d35',
  },
  cardImage: { height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#2c2d35' },
  cardImagePlaceholder: { height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#2c2d35' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  cardSubtitle: { fontSize: 14, color: '#7c7e8c', marginTop: 4 },
  empty: { textAlign: 'center', color: '#7c7e8c', marginTop: 32, paddingHorizontal: 16 },
  footerLoading: { paddingVertical: 16 },
  firstLoadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 16, 20, 0.45)',
  },
});
