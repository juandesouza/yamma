import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roles = url.searchParams.get('roles');
    const cookie = req.headers.get('cookie') ?? '';
    const target = roles ? `${API}/users?roles=${encodeURIComponent(roles)}` : `${API}/users`;

    const res = await fetch(target, {
      headers: { cookie },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: 'Users service unavailable. Is the backend running?' },
      { status: 503 }
    );
  }
}
