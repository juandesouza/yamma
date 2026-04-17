import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get('lat') ?? '';
    const lng = url.searchParams.get('lng') ?? '';
    const target = `${API}/mapbox/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
    const res = await fetch(target, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Map service unavailable' }, { status: 503 });
  }
}
