import { cookies } from 'next/headers';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SessionUser {
  id: string;
  email?: string;
  name: string;
  role: string;
  fiatBalance?: string;
}

export interface UserOrder {
  id: string;
  userId: string;
  restaurantId: string;
  status: string;
  deliveryAddress: string;
  subtotal?: string;
  deliveryFee?: string;
  total?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerRestaurantState {
  hasRestaurant: boolean;
  hasMenuItems: boolean;
}

/** Builds a valid `Cookie` header for forwarding to the API (more reliable than `cookies().toString()`). */
export async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieHeader = await getCookieHeader();
    if (!cookieHeader) return null;

    const res = await fetch(`${API}/auth/me`, {
      method: 'POST',
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function getUserOrders(): Promise<UserOrder[]> {
  try {
    const cookieHeader = await getCookieHeader();
    if (!cookieHeader) return [];

    const res = await fetch(`${API}/orders`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getSellerRestaurantState(): Promise<SellerRestaurantState> {
  try {
    const cookieHeader = await getCookieHeader();
    if (!cookieHeader) return { hasRestaurant: false, hasMenuItems: false };
    const res = await fetch(`${API}/restaurants/mine`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { hasRestaurant: false, hasMenuItems: false };
    const data = await res.json().catch(() => null);
    const hasRestaurant = Boolean(data?.restaurant?.id);
    const hasMenuItems = Boolean(
      Array.isArray(data?.menus) &&
        data.menus.some((m: { items?: unknown[] }) => Array.isArray(m.items) && m.items.length > 0)
    );
    return { hasRestaurant, hasMenuItems };
  } catch {
    return { hasRestaurant: false, hasMenuItems: false };
  }
}
