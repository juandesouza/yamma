import { NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/restaurants/mine/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Restaurant service unavailable' }, { status: 503 });
  }
}
