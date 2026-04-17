import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function forwardAuthCookie(response: Response, redirectTo: string, request: NextRequest) {
  const nextResponse = NextResponse.redirect(new URL(redirectTo, request.url));
  const getSetCookie = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const cookiesList =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : (() => {
          const single = response.headers.get('set-cookie');
          return single ? [single] : [];
        })();
  for (const c of cookiesList) {
    nextResponse.headers.append('set-cookie', c);
  }
  return nextResponse;
}

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/';
  const role = request.nextUrl.searchParams.get('role') === 'seller' ? 'seller' : 'buyer';

  try {
    const res = await fetch(`${API}/auth/guest-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
      cache: 'no-store',
    });

    if (res.ok) {
      return forwardAuthCookie(res, redirectTo, request);
    }

    return NextResponse.redirect(new URL('/login?error=guest-login-failed', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=guest-unavailable', request.url));
  }
}
