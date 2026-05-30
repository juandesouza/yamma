import { NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const cookie = req.headers.get('cookie') ?? '';

    const res = await fetch(`${API}/users/${id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: 'Unable to update user role right now.' },
      { status: 503 }
    );
  }
}
