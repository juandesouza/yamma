import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const limit = url.searchParams.get('limit') ?? '5';
    const target = `${API}/mapbox/geocode?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(target, { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Map service unavailable' }, { status: 503 });
  }
}
