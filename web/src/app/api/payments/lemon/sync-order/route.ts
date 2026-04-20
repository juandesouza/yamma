import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/payments/lemon/sync-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Payments service unavailable' }, { status: 503 });
  }
}
