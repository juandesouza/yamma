import { Injectable } from '@nestjs/common';
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

@Injectable()
export class MapboxService {
  private readonly nominatimBase = 'https://nominatim.openstreetmap.org';
  private readonly osrmBase = 'https://router.project-osrm.org';
  private readonly userAgent = 'yamma-app/1.0 (geocoding)';

  constructor(private config: ConfigService) {}

  async geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (!q) return [];
    const res = await fetch(`${this.nominatimBase}/search?${new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '0',
      limit: String(Math.min(10, Math.max(1, limit))),
    }).toString()}`, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim error: ${await res.text()}`);
    const data = (await res.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    return data
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
    const res = await fetch(`${this.nominatimBase}/reverse?${new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '0',
    }).toString()}`, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim error: ${await res.text()}`);
    const data = (await res.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
    };
    if (!data.display_name) return null;
    return {
      address: data.display_name,
      longitude: Number(data.lon),
      latitude: Number(data.lat),
      placeName: data.display_name,
    };
  }

  async getDistanceAndEta(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<RouteResult> {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(`${this.osrmBase}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error(`OSRM error: ${await res.text()}`);
    const data = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: unknown;
      }>;
    };
    const route = data.routes?.[0];
    if (!route) throw new Error('No route found');
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: Math.round(route.duration / 60),
      geometry: route.geometry,
    };
  }
}
