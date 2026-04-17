import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status >= 500) {
      return NextResponse.json(
        { message: 'Registration is temporarily unavailable. Please check the backend database connection.' },
        { status: 503 }
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: 'Auth service unavailable. Is the backend running?' },
      { status: 503 }
    );
  }
}
