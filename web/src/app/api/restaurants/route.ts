import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('yamma_session')?.value) {
      return NextResponse.json({ message: 'Sign in to browse restaurants.' }, { status: 401 });
    }
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const target = qs ? `${API}/restaurants?${qs}` : `${API}/restaurants`;
    const res = await fetch(target, { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: 'Restaurant service unavailable. Is the backend running?' },
      { status: 503 }
    );
  }
}
