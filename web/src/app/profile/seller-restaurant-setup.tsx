'use client';

import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, Input } from '@yamma/design-system';
import { MapAssistedAddressField } from '@/components/map-assisted-address-field';

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  address: string;
  description?: string | null;
  cuisine?: string | null;
  imageUrl?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type MenuItemRow = { id: string; name: string; price: string };

type MineResponse = {
  restaurant: RestaurantRow | null;
  menus: Array<{ id: string; name: string; items: MenuItemRow[] }>;
};

export function SellerRestaurantSetup() {
  const pathname = usePathname();
  const router = useRouter();
  const [mine, setMine] = useState<MineResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingMine, setLoadingMine] = useState(true);

  const [rName, setRName] = useState('');
  const [rCuisine, setRCuisine] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [rImageUrl, setRImageUrl] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');

  const [itemName, setItemName] = useState('Test bowl');
  const [itemPrice, setItemPrice] = useState('12.99');
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState('');
  const [itemMessage, setItemMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoadError('');
    const res = await fetch('/api/restaurants/mine', { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoadError(typeof data?.message === 'string' ? data.message : 'Could not load restaurant');
      setMine(null);
      return;
    }
    const data = (await res.json()) as MineResponse;
    setMine(data);
    if (data?.restaurant) {
      setRName(data.restaurant.name ?? '');
      setRAddress(data.restaurant.address ?? '');
      setRCuisine(data.restaurant.cuisine ?? '');
      setRDescription(data.restaurant.description ?? '');
      setRImageUrl(data.restaurant.imageUrl ?? '');
      const lat = Number(data.restaurant.latitude);
      const lng = Number(data.restaurant.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoords({ lat, lng });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMine(true);
    void (async () => {
      await refresh();
      if (!cancelled) setLoadingMine(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function onCreateRestaurant(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!coords) {
      setCreateError('Select your address from the map helper so we can save accurate coordinates.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/restaurants/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: rName,
          cuisine: rCuisine || undefined,
          address: rAddress,
          description: rDescription || undefined,
          imageUrl: rImageUrl || undefined,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
              ? data.message.map((m: unknown) => String(m)).join(', ')
              : 'Could not create restaurant';
        setCreateError(msg);
        return;
      }
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    setItemError('');
    setItemMessage('');
    const price = parseFloat(itemPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setItemError('Enter a valid price');
      return;
    }
    setAddingItem(true);
    try {
      const res = await fetch('/api/restaurants/mine/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: itemName, price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItemError(typeof data?.message === 'string' ? data.message : 'Could not add item');
        return;
      }
      setItemMessage('Menu item added');
      await refresh();
    } finally {
      setAddingItem(false);
    }
  }

  async function onUpdateRestaurant(e: FormEvent) {
    e.preventDefault();
    setUpdateError('');
    setUpdateMessage('');
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = {
        name: rName,
        address: rAddress,
        cuisine: rCuisine || undefined,
        description: rDescription || undefined,
        imageUrl: rImageUrl || undefined,
      };
      if (coords) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }
      const res = await fetch('/api/restaurants/mine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
              ? data.message.map((m: unknown) => String(m)).join(', ')
              : 'Could not update restaurant';
        setUpdateError(msg);
        return;
      }
      setUpdateMessage('Restaurant profile updated');
      await refresh();
    } finally {
      setUpdating(false);
    }
  }

  const restaurant = mine?.restaurant ?? null;
  const itemCount =
    mine?.menus?.reduce((n, m) => n + (m.items?.length ?? 0), 0) ?? 0;
  const isSetupFlow = pathname === '/seller/setup';

  if (loadingMine) {
    return (
      <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface-elevated)] p-5">
        <p className="text-sm text-[var(--yamma-text-muted)]">Loading your restaurant…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface-elevated)] p-5">
        <p className="text-sm text-[#ef4444]">{loadError}</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface-elevated)] p-5">
        <h3 className="text-lg font-semibold text-[var(--yamma-text)]">Restaurant profile</h3>
        <p className="mt-1 text-sm text-[var(--yamma-text-muted)]">
          Create your listing so customers and drivers can locate your place accurately.
        </p>
        <form onSubmit={onCreateRestaurant} className="mt-4 space-y-3">
          <Input label="Restaurant name" value={rName} onChange={(e: ChangeEvent<HTMLInputElement>) => setRName(e.target.value)} required fullWidth />
          <Input label="Cuisine (optional)" value={rCuisine} onChange={(e: ChangeEvent<HTMLInputElement>) => setRCuisine(e.target.value)} fullWidth />
          <MapAssistedAddressField
            address={rAddress}
            onAddressChange={setRAddress}
            coords={coords}
            onCoordsChange={setCoords}
          />
          <Input
            label="Description (optional)"
            value={rDescription}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRDescription(e.target.value)}
            fullWidth
          />
          <Input
            label="Picture URL (optional)"
            value={rImageUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            fullWidth
          />
          <p className="text-xs text-[var(--yamma-text-muted)]">
            Paste a direct image link (.jpg, .png, .webp), not a webpage URL — article pages cannot be shown as photos.
          </p>
          {createError && <p className="text-sm text-[#ef4444]">{createError}</p>}
          <Button type="submit" loading={creating} className="mt-2">
            Create restaurant
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface-elevated)] p-5">
      <h3 className="text-lg font-semibold text-[var(--yamma-text)]">Restaurant profile</h3>
      <p className="mt-1 text-sm text-[var(--yamma-text-subtle)]">
        <span className="font-medium text-[var(--yamma-text)]">{restaurant.name}</span>
        <span className="text-[var(--yamma-text-muted)]"> · {restaurant.address}</span>
      </p>
      <p className="mt-2 text-sm text-[var(--yamma-text-muted)]">
        {itemCount === 0
          ? 'Add at least one menu item so buyers can add food to the cart and pay you (Lemon Squeezy test card or in-app balance).'
          : `${itemCount} menu item(s). Share your page with a test buyer account.`}
      </p>
      {isSetupFlow && itemCount > 0 && (
        <p className="mt-2 text-sm text-[#22c55e]">
          Setup completed. You can now open the seller orders dashboard.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/restaurant/${restaurant.id}`}
          className="inline-flex rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--yamma-text-secondary)] hover:border-[var(--yamma-primary)]"
        >
          View public page
        </Link>
      </div>

      {!isSetupFlow && (
        <form onSubmit={onUpdateRestaurant} className="mt-6 border-t border-[var(--yamma-border)] pt-5">
          <h4 className="text-sm font-semibold text-[var(--yamma-text)]">Edit restaurant profile</h4>
          <div className="mt-3 space-y-3">
            <Input label="Restaurant name" value={rName} onChange={(e: ChangeEvent<HTMLInputElement>) => setRName(e.target.value)} required fullWidth />
            <Input label="Cuisine (optional)" value={rCuisine} onChange={(e: ChangeEvent<HTMLInputElement>) => setRCuisine(e.target.value)} fullWidth />
            <MapAssistedAddressField
            address={rAddress}
            onAddressChange={setRAddress}
            coords={coords}
            onCoordsChange={setCoords}
          />
            <Input
              label="Description (optional)"
              value={rDescription}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRDescription(e.target.value)}
              fullWidth
            />
            <Input
              label="Picture URL (optional)"
              value={rImageUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRImageUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              fullWidth
            />
            <p className="text-xs text-[var(--yamma-text-muted)]">
              Direct image link only (.jpg, .png, .webp), not a news or article page URL.
            </p>
          </div>
          {updateError && <p className="mt-2 text-sm text-[#ef4444]">{updateError}</p>}
          {updateMessage && <p className="mt-2 text-sm text-[#22c55e]">{updateMessage}</p>}
          <Button type="submit" className="mt-4" loading={updating}>
            Save restaurant profile
          </Button>
        </form>
      )}

      <form onSubmit={onAddItem} className="mt-6 border-t border-[var(--yamma-border)] pt-5">
        <h4 className="text-sm font-semibold text-[var(--yamma-text)]">Add menu item</h4>
        <div className="mt-3 space-y-3">
          <Input label="Item name" value={itemName} onChange={(e: ChangeEvent<HTMLInputElement>) => setItemName(e.target.value)} required fullWidth />
          <Input
            label="Price (USD)"
            value={itemPrice}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setItemPrice(e.target.value)}
            required
            fullWidth
          />
        </div>
        {itemError && <p className="mt-2 text-sm text-[#ef4444]">{itemError}</p>}
        {itemMessage && <p className="mt-2 text-sm text-[#22c55e]">{itemMessage}</p>}
        <Button type="submit" className="mt-4" loading={addingItem} variant="secondary">
          Add item
        </Button>
        {isSetupFlow && (
          <Button
            type="button"
            className="mt-3"
            onClick={() => router.push('/seller/orders')}
            disabled={itemCount === 0}
          >
            Save and continue
          </Button>
        )}
      </form>
    </div>
  );
}
