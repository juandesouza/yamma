import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry?: unknown;
}

/** Mapbox Geocoding JSON feature (subset). */
interface MapboxPlaceFeature {
  place_name?: string;
  /** [lng, lat] */
  center?: [number, number];
  geometry?: { type?: string; coordinates?: [number, number] };
}

interface MapboxGeocodeBody {
  features?: MapboxPlaceFeature[];
}

@Injectable()
export class MapboxService {
  private readonly log = new Logger(MapboxService.name);
  /** Public Nominatim — heavily rate-limits shared cloud IPs (e.g. Render). Use MAPBOX_ACCESS_TOKEN in production. */
  private readonly nominatimBase = 'https://nominatim.openstreetmap.org';
  private readonly osrmBase = 'https://router.project-osrm.org';
  /** https://operations.osmfoundation.org/policies/nominatim/ — identify app clearly */
  private readonly nominatimUserAgent =
    'Yamma/1 (food delivery checkout; repo https://github.com/juandesouza/yamma)';

  /** Short-lived memo for repeated reverse lookups (pin drag). */
  private readonly reverseMemo = new Map<string, GeocodeResult | null>();
  private readonly reverseMemoOrder: string[] = [];
  private static readonly MEMO_CAP = 200;

  constructor(private config: ConfigService) {}

  private memoKey(lat: number, lng: number) {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  private rememberReverse(lat: number, lng: number, value: GeocodeResult | null) {
    const k = this.memoKey(lat, lng);
    if (!this.reverseMemo.has(k)) {
      this.reverseMemoOrder.push(k);
      while (this.reverseMemoOrder.length > MapboxService.MEMO_CAP) {
        const oldest = this.reverseMemoOrder.shift();
        if (oldest) this.reverseMemo.delete(oldest);
      }
    }
    this.reverseMemo.set(k, value);
  }

  /** Map temporary geocoding (search / suggestions). Mapbox advises this for autocomplete. */
  private mapboxGeocodeUrl(query: string, limit: number) {
    const token = this.config.mapboxToken;
    if (!token) return null;
    const qs = new URLSearchParams({
      access_token: token,
      limit: String(Math.min(10, Math.max(1, limit))),
      types: 'address,place,locality,neighborhood,district,postcode,region,country',
    });
    const path = encodeURIComponent(query.trim());
    return `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${qs.toString()}`;
  }

  private mapboxReverseUrl(lat: number, lng: number) {
    const token = this.config.mapboxToken;
    if (!token) return null;
    const qs = new URLSearchParams({ access_token: token, limit: '1' });
    return `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${qs.toString()}`;
  }

  private mapFeatureToGeocode(feature: MapboxPlaceFeature): GeocodeResult | null {
    const placeName = feature.place_name;
    const fromCenter = Array.isArray(feature.center) ? feature.center : null;
    const fromGeom =
      Array.isArray(feature.geometry?.coordinates) && feature.geometry?.coordinates!.length >= 2
        ? ([feature.geometry!.coordinates![0], feature.geometry!.coordinates![1]] as [number, number])
        : null;
    const lngLat = fromCenter ?? fromGeom;
    if (!placeName || !lngLat) return null;
    const [longitude, latitude] = lngLat;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      address: placeName,
      latitude,
      longitude,
      placeName,
    };
  }

  async geocodeWithMapbox(q: string, limit: number): Promise<GeocodeResult[]> {
    const url = this.mapboxGeocodeUrl(q, limit);
    if (!url) return [];
    const res = await fetch(url);
    const bodyText = await res.text();
    if (!res.ok) {
      this.log.warn(`Mapbox geocode HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
      return [];
    }
    let data: MapboxGeocodeBody;
    try {
      data = JSON.parse(bodyText) as MapboxGeocodeBody;
    } catch {
      return [];
    }
    const list = Array.isArray(data.features) ? data.features : [];
    const out: GeocodeResult[] = [];
    for (const f of list) {
      const row = this.mapFeatureToGeocode(f);
      if (row) out.push(row);
    }
    return out;
  }

  async reverseWithMapbox(lat: number, lng: number): Promise<GeocodeResult | null> {
    const url = this.mapboxReverseUrl(lat, lng);
    if (!url) return null;
    const res = await fetch(url);
    const bodyText = await res.text();
    if (!res.ok) {
      this.log.warn(`Mapbox reverse HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
      return null;
    }
    let data: MapboxGeocodeBody;
    try {
      data = JSON.parse(bodyText) as MapboxGeocodeBody;
    } catch {
      return null;
    }
    const f = data.features?.[0];
    return f ? this.mapFeatureToGeocode(f) : null;
  }

  /** Nominatim — only safe for low-volume / dev behind shared IPs; tolerate 429. */
  private async nominatimFetchJson(urlStr: string, context: string): Promise<unknown | null> {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent': this.nominatimUserAgent,
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      try {
        return (await res.json()) as unknown;
      } catch {
        return null;
      }
    }
    const snippet = await res.text();
    if (res.status === 429) {
      this.log.warn(
        `Nominatim rate limited (${context}). Set MAPBOX_ACCESS_TOKEN on the API for checkout geocode.`,
      );
      return null;
    }
    this.log.warn(`Nominatim ${context} HTTP ${res.status}: ${snippet.slice(0, 200)}`);
    return null;
  }

  async geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (!q) return [];

    if (this.config.mapboxToken) {
      const fromMb = await this.geocodeWithMapbox(q, limit);
      if (fromMb.length) return fromMb;
    }

    const url = `${this.nominatimBase}/search?${new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '0',
      limit: String(Math.min(10, Math.max(1, limit))),
    }).toString()}`;
    const data = await this.nominatimFetchJson(url, 'search');
    if (!Array.isArray(data)) return [];
    return (
      data as Array<{ display_name?: string; lat?: string; lon?: string }>
    )
      .map((f) => ({
        address: f.display_name ?? '',
        longitude: Number(f.lon),
        latitude: Number(f.lat),
        placeName: f.display_name,
      }))
      .filter((f) => f.address && Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const k = this.memoKey(lat, lng);
    if (this.reverseMemo.has(k)) return this.reverseMemo.get(k) ?? null;

    if (this.config.mapboxToken) {
      try {
        const fromMb = await this.reverseWithMapbox(lat, lng);
        if (fromMb?.address) {
          this.rememberReverse(lat, lng, fromMb);
          return fromMb;
        }
      } catch (e) {
        this.log.warn(`Mapbox reverse threw: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const url = `${this.nominatimBase}/reverse?${new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '0',
    }).toString()}`;
    const data = await this.nominatimFetchJson(url, 'reverse');
    if (!data || typeof data !== 'object') {
      this.rememberReverse(lat, lng, null);
      return null;
    }
    const raw = data as { display_name?: string; lat?: string; lon?: string };
    if (!raw.display_name) {
      this.rememberReverse(lat, lng, null);
      return null;
    }
    const parsed: GeocodeResult = {
      address: raw.display_name,
      longitude: Number(raw.lon),
      latitude: Number(raw.lat),
      placeName: raw.display_name,
    };
    const value =
      Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude) ? parsed : null;
    this.rememberReverse(lat, lng, value);
    return value;
  }

  async getDistanceAndEta(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(`${this.osrmBase}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error(`OSRM error: ${await res.text()}`);
    const body = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: unknown;
      }>;
    };
    const route = body.routes?.[0];
    if (!route) throw new Error('No route found');
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: Math.round(route.duration / 60),
      geometry: route.geometry,
    };
  }
}
