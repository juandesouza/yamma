import { NextRequest, NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
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

    if (res.status === 503) {
      return NextResponse.redirect(new URL('/login?error=guest-db-unavailable', request.url));
    }

    const bodyText = await res.text().catch(() => '');
    console.error('[guest-login] backend failed', res.status, bodyText.slice(0, 500));
    return NextResponse.redirect(new URL('/login?error=guest-login-failed', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=guest-unavailable', request.url));
  }
}
