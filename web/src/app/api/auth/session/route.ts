import { NextResponse } from 'next/server';
import { isGuestUser } from '@/lib/auth-constants';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Returns current user from backend session cookie (for client components). */
export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') ?? '';
    if (!cookie) {
      return NextResponse.json({ user: null, isGuest: false });
    }

    const res = await fetch(`${API}/auth/me`, {
      method: 'POST',
      headers: { cookie },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ user: null, isGuest: false });
    }

    const data = await res.json().catch(() => null);
    const user = data?.user ?? null;
    return NextResponse.json({
      user,
      isGuest: isGuestUser(user),
    });
  } catch {
    return NextResponse.json({ user: null, isGuest: false }, { status: 503 });
  }
}
