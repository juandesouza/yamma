import AsyncStorage from '@react-native-async-storage/async-storage';

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: string;
  quantity: number;
};

type CartMap = Record<string, CartLine[]>;

const STORAGE_KEY = 'yamma_cart_v1';
const ADDRESS_PREFIX = 'yamma_checkout_address_v1';
const DELIVERY_KEY = 'yamma_checkout_delivery_v2';

export type SavedDelivery = { address: string; lat?: number; lng?: number };

async function readCartMap(): Promise<CartMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CartMap;
  } catch {
    return {};
  }
}

async function writeCartMap(map: CartMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function loadCart(restaurantId: string): Promise<CartLine[]> {
  const map = await readCartMap();
  const rows = map[restaurantId];
  return Array.isArray(rows) ? rows : [];
}

export async function addCartLine(
  restaurantId: string,
  line: { menuItemId: string; name: string; unitPrice: string },
): Promise<number> {
  const map = await readCartMap();
  const rows = Array.isArray(map[restaurantId]) ? [...map[restaurantId]] : [];
  const idx = rows.findIndex((r) => r.menuItemId === line.menuItemId);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], quantity: rows[idx].quantity + 1 };
  } else {
    rows.push({ ...line, quantity: 1 });
  }
  map[restaurantId] = rows;
  await writeCartMap(map);
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

export async function incrementCartLine(restaurantId: string, menuItemId: string): Promise<CartLine[]> {
  const map = await readCartMap();
  const rows = Array.isArray(map[restaurantId]) ? [...map[restaurantId]] : [];
  const idx = rows.findIndex((r) => r.menuItemId === menuItemId);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], quantity: rows[idx].quantity + 1 };
  }
  map[restaurantId] = rows;
  await writeCartMap(map);
  return rows;
}

export async function decrementCartLine(restaurantId: string, menuItemId: string): Promise<CartLine[]> {
  const map = await readCartMap();
  const rows = Array.isArray(map[restaurantId]) ? [...map[restaurantId]] : [];
  const idx = rows.findIndex((r) => r.menuItemId === menuItemId);
  if (idx >= 0) {
    const nextQty = rows[idx].quantity - 1;
    if (nextQty <= 0) {
      rows.splice(idx, 1);
    } else {
      rows[idx] = { ...rows[idx], quantity: nextQty };
    }
  }
  map[restaurantId] = rows;
  await writeCartMap(map);
  return rows;
}

export async function removeCartLine(restaurantId: string, menuItemId: string): Promise<CartLine[]> {
  const map = await readCartMap();
  const rows = Array.isArray(map[restaurantId]) ? [...map[restaurantId]] : [];
  const next = rows.filter((r) => r.menuItemId !== menuItemId);
  map[restaurantId] = next;
  await writeCartMap(map);
  return next;
}

export async function clearCart(restaurantId: string): Promise<void> {
  const map = await readCartMap();
  delete map[restaurantId];
  await writeCartMap(map);
}

export async function cartLineCount(restaurantId: string): Promise<number> {
  const rows = await loadCart(restaurantId);
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

export function cartSubtotal(rows: CartLine[]): number {
  return rows.reduce((sum, r) => sum + Number(r.unitPrice) * r.quantity, 0);
}

export async function loadSavedDelivery(userId?: string | null): Promise<SavedDelivery> {
  const uid = userId ?? 'guest';
  const raw = await AsyncStorage.getItem(`${DELIVERY_KEY}:${uid}`);
  if (raw) {
    try {
      const p = JSON.parse(raw) as SavedDelivery;
      if (typeof p.address === 'string') {
        return {
          address: p.address.trim(),
          lat: typeof p.lat === 'number' ? p.lat : undefined,
          lng: typeof p.lng === 'number' ? p.lng : undefined,
        };
      }
    } catch {
      /* legacy */
    }
  }
  const legacy = await AsyncStorage.getItem(`${ADDRESS_PREFIX}:${uid}`);
  return { address: legacy?.trim() ?? '' };
}

export async function saveDelivery(d: SavedDelivery, userId?: string | null): Promise<void> {
  const uid = userId ?? 'guest';
  const payload: SavedDelivery = {
    address: d.address.trim(),
    ...(typeof d.lat === 'number' &&
    typeof d.lng === 'number' &&
    Number.isFinite(d.lat) &&
    Number.isFinite(d.lng)
      ? { lat: d.lat, lng: d.lng }
      : {}),
  };
  await AsyncStorage.setItem(`${DELIVERY_KEY}:${uid}`, JSON.stringify(payload));
}

/** @deprecated Prefer loadSavedDelivery — kept for callers that only need the string. */
export async function loadSavedAddress(userId?: string | null): Promise<string> {
  const d = await loadSavedDelivery(userId);
  return d.address;
}

/** @deprecated Prefer saveDelivery — coords are not stored. */
export async function saveAddress(address: string, userId?: string | null): Promise<void> {
  await saveDelivery({ address }, userId);
}
