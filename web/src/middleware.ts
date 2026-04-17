import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('yamma_session');
  if (session?.value) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/restaurant/:path*', '/checkout', '/checkout/:path*', '/profile/:path*', '/order/:path*', '/admin/:path*'],
};
