'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RestaurantCard } from '@yamma/design-system';

/** East US fallback when geolocation is denied or unavailable */
const FALLBACK_LAT = 38.9072;
const FALLBACK_LNG = -77.0369;
/** Page size for infinite scroll (must match stable sort from API). */
const PAGE_SIZE = 12;

type RestaurantRow = {
  id: string;
  name: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  description?: string | null;
  distance?: string | null;
  isOpen?: boolean | null;
};

type Coords = { lat: number; lng: number };

async function fetchRestaurantPage(coords: Coords, offset: number): Promise<RestaurantRow[]> {
  const qs = new URLSearchParams({
    lat: String(coords.lat),
    lng: String(coords.lng),
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  const res = await fetch(`/api/restaurants?${qs.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof data?.message === 'string' ? data.message : 'Could not load restaurants.';
    throw new Error(msg);
  }
  if (!Array.isArray(data)) throw new Error('Unexpected response from server.');
  return data as RestaurantRow[];
}

export function HomeRestaurantGrid() {
  const [hint, setHint] = useState('Finding your location…');
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const coordsRef = useRef<Coords | null>(null);
  const restaurantsRef = useRef<RestaurantRow[]>([]);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    restaurantsRef.current = restaurants;
  }, [restaurants]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadMore = useCallback(async () => {
    const coords = coordsRef.current;
    if (!coords || !hasMoreRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    const offset = restaurantsRef.current.length;
    try {
      const batch = await fetchRestaurantPage(coords, offset);
      const prev = restaurantsRef.current;
      const seen = new Set(prev.map((r) => r.id));
      const merged = [...prev];
      for (const row of batch) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          merged.push(row);
        }
      }
      restaurantsRef.current = merged;
      setRestaurants(merged);
      const more = batch.length === PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
      if (more) {
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            const el = sentinelRef.current;
            if (!el || !hasMoreRef.current || loadingMoreRef.current) return;
            const r = el.getBoundingClientRect();
            if (r.top <= window.innerHeight + 280) void loadMore();
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more restaurants.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad(coords: Coords, loadingMessage: string) {
      coordsRef.current = coords;
      setHint(loadingMessage);
      setError(null);
      setHasMore(true);
      hasMoreRef.current = true;
      try {
        const batch = await fetchRestaurantPage(coords, 0);
        if (cancelled) return;
        restaurantsRef.current = batch;
        setRestaurants(batch);
        setHasMore(batch.length === PAGE_SIZE);
        hasMoreRef.current = batch.length === PAGE_SIZE;
        setHint('');
      } catch (e) {
        if (cancelled) return;
        setRestaurants([]);
        setError(e instanceof Error ? e.message : 'Could not load restaurants.');
        setHint('');
        setHasMore(false);
        hasMoreRef.current = false;
      }
    }

    function onCoords(coords: Coords, loadingMessage: string) {
      if (cancelled) return;
      void initialLoad(coords, loadingMessage);
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onCoords(
        { lat: FALLBACK_LAT, lng: FALLBACK_LNG },
        'Loading restaurants…'
      );
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCoords(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          'Loading nearby restaurants…'
        );
      },
      () => {
        onCoords(
          { lat: FALLBACK_LAT, lng: FALLBACK_LNG },
          'Location unavailable — showing restaurants near Washington, DC (enable location for miles from you).'
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || hint) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        void loadMore();
      },
      { root: null, rootMargin: '240px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hint, loadMore, hasMore]);

  return (
    <>
      {hint ? (
        <div
          className="mb-6 flex flex-col items-center justify-center gap-0 py-6"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-[var(--yamma-primary)] border-t-transparent"
            aria-hidden
          />
          <span className="sr-only">{hint}</span>
        </div>
      ) : null}
      {error ? <p className="mb-4 text-sm text-[#ef4444]">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4">
        {restaurants.map((r) => (
          <Link key={r.id} href={`/restaurant/${r.id}`} className="block min-w-0">
            <RestaurantCard
              id={r.id}
              name={r.name}
              imageUrl={r.imageUrl ?? undefined}
              cuisine={r.cuisine ?? undefined}
              description={r.description ?? undefined}
              deliveryTime="30–45 min"
              distance={r.distance ?? undefined}
              isOpen={r.isOpen ?? true}
            />
          </Link>
        ))}
      </div>

      {!hint && hasMore ? (
        <div className="flex flex-col items-center py-6">
          {loadingMore ? (
            <div className="flex flex-col items-center gap-2 text-[var(--yamma-text-muted)]">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--yamma-primary)] border-t-transparent"
                role="status"
                aria-label="Loading more restaurants"
              />
              <span className="text-sm">Loading more…</span>
            </div>
          ) : null}
          <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      ) : null}

      {!hint && !error && restaurants.length === 0 ? (
        <div className="mx-auto flex max-w-xl flex-col gap-3 py-12 text-center text-[var(--yamma-text-muted)]">
          <p>No restaurants to show.</p>
          <p className="text-sm text-[var(--yamma-text-secondary)]">
            Only venues with at least one <strong className="font-medium">available menu item</strong> appear here.
            Seed demo data from the <strong className="font-medium">monorepo root</strong> (
            <code className="rounded px-0.5 text-xs">backend/.env</code> must point at this app&apos;s{' '}
            <code className="rounded px-0.5 text-xs">DATABASE_URL</code> for production):
          </p>
          <div>
            <span className="text-xs text-[var(--yamma-text-muted)]">Hosted DB (ignores .env.local)</span>
            <div className="mt-1 max-w-full overflow-x-auto rounded-md border border-[var(--yamma-border)] bg-[var(--yamma-surface)] px-3 py-2 text-left">
              <code className="block font-mono text-xs text-[var(--yamma-text-secondary)] whitespace-nowrap">
                pnpm --filter backend run seed:buyer-demo:env
              </code>
            </div>
          </div>
          <div>
            <span className="text-xs text-[var(--yamma-text-muted)]">Local Docker (uses .env.local if present)</span>
            <div className="mt-1 max-w-full overflow-x-auto rounded-md border border-[var(--yamma-border)] bg-[var(--yamma-surface)] px-3 py-2 text-left">
              <code className="block font-mono text-xs text-[var(--yamma-text-secondary)] whitespace-nowrap">
                pnpm --filter backend run seed:buyer-demo
              </code>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
