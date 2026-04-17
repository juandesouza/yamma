'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@yamma/design-system';

export type GeoCoords = { lat: number; lng: number };

type GeoResult = {
  address: string;
  latitude: number;
  longitude: number;
  placeName?: string;
};

type Props = {
  address: string;
  onAddressChange: (value: string) => void;
  coords: GeoCoords | null;
  onCoordsChange: (value: GeoCoords | null) => void;
};

export function MapAssistedAddressField({
  address,
  onAddressChange,
  coords,
  onCoordsChange,
}: Props) {
  const [addressLookupError, setAddressLookupError] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<GeoResult[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const q = address.trim();
    if (q.length < 5) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingAddress(true);
      setAddressLookupError('');
      try {
        const res = await fetch(`/api/mapbox/geocode?q=${encodeURIComponent(q)}&limit=6`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setAddressSuggestions([]);
          return;
        }
        setAddressSuggestions(data as GeoResult[]);
      } catch {
        setAddressSuggestions([]);
        setAddressLookupError('Could not search addresses right now.');
      } finally {
        setSearchingAddress(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [address]);

  async function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAddressLookupError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setAddressLookupError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onCoordsChange({ lat, lng });
        try {
          const res = await fetch(
            `/api/mapbox/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
            { credentials: 'include' }
          );
          const data = (await res.json().catch(() => null)) as GeoResult | null;
          if (res.ok && data?.address) {
            onAddressChange(data.address);
          } else {
            setAddressLookupError(
              'Location found, but address lookup failed. Search and select your address.'
            );
          }
        } catch {
          setAddressLookupError(
            'Location found, but address lookup failed. Search and select your address.'
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setAddressLookupError('Could not access your location. Allow geolocation and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 120_000 }
    );
  }

  function pickSuggestion(s: GeoResult) {
    onAddressChange(s.address);
    onCoordsChange({ lat: s.latitude, lng: s.longitude });
    setAddressSuggestions([]);
  }

  const mapUrl = useMemo(() => {
    if (!coords) return null;
    const { lat, lng } = coords;
    const delta = 0.0045;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  }, [coords]);

  return (
    <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={useCurrentLocation} loading={locating}>
          Use my current location
        </Button>
        <span className="text-xs text-[var(--yamma-text-muted)]">
          Then search/select the exact street address below.
        </span>
      </div>
      <div className="mt-3">
        <Input
          label="Address (search street and number)"
          value={address}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onAddressChange(e.target.value)}
          placeholder="Type your street, number, city..."
          required
          fullWidth
        />
        {searchingAddress ? <p className="mt-2 text-xs text-[var(--yamma-text-muted)]">Searching addresses…</p> : null}
        {addressSuggestions.length > 0 ? (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)]">
            {addressSuggestions.map((s, idx) => (
              <button
                key={`${s.address}-${idx}`}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="block w-full border-b border-[var(--yamma-divider-subtle)] px-3 py-2 text-left text-sm text-[var(--yamma-text-secondary)] hover:bg-[var(--yamma-surface)] last:border-b-0"
              >
                {s.address}
              </button>
            ))}
          </div>
        ) : null}
        {addressLookupError ? <p className="mt-2 text-xs text-[#ef4444]">{addressLookupError}</p> : null}
      </div>
      <div className="mt-3">
        {mapUrl ? (
          <iframe
            title="Selected address map"
            src={mapUrl}
            className="h-56 w-full rounded-xl border border-[var(--yamma-border-muted)]"
            loading="lazy"
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-3 py-6 text-center text-xs text-[var(--yamma-text-muted)]">
            Select an address to preview it on the map.
          </div>
        )}
      </div>
    </div>
  );
}
