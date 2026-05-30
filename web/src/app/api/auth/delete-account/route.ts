import { NextResponse } from 'next/server';

import { BACKEND_API_URL as API } from '@/lib/backend-api-url';
export async function POST(req: Request) {
  try {
    const res = await fetch(`${API}/auth/delete-account`, {
      method: 'POST',
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    const nextRes = NextResponse.json(data, { status: res.status });
    const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    const cookiesList =
      typeof getSetCookie === 'function'
        ? getSetCookie.call(res.headers)
        : (() => {
            const single = res.headers.get('set-cookie');
            return single ? [single] : [];
          })();
    for (const c of cookiesList) {
      nextRes.headers.append('set-cookie', c);
    }
    return nextRes;
  } catch {
    return NextResponse.json({ message: 'Auth service unavailable.' }, { status: 503 });
  }
}
