import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    const nextRes = NextResponse.json(data, { status: res.status });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) nextRes.headers.set('set-cookie', setCookie);
    return nextRes;
  } catch (err) {
    return NextResponse.json(
      { message: 'Auth service unavailable. Is the backend running?' },
      { status: 503 }
    );
  }
}
