import { NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
export async function GET(req: Request) {
  try {
    const res = await fetch(`${API}/orders/restaurant`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      credentials: 'include',
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Orders service unavailable' }, { status: 503 });
  }
}
