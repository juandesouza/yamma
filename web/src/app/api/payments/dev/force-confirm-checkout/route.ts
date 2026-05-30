import { NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
const DEV_HEADER = 'x-yamma-dev-force-confirm-token';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = req.headers.get(DEV_HEADER);
    const res = await fetch(`${API}/payments/dev/force-confirm-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
        ...(token ? { [DEV_HEADER]: token } : {}),
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
