import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const DEMO_USER = {
  name: 'John Example',
  email: 'john.example@yamma.demo',
  password: 'JohnExample2026!',
};

async function forwardAuthCookie(response: Response, redirectTo: string, request: NextRequest) {
  const nextResponse = NextResponse.redirect(new URL(redirectTo, request.url));
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) nextResponse.headers.set('set-cookie', setCookie);
  return nextResponse;
}

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/';

  try {
    const loginResponse = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: DEMO_USER.email,
        password: DEMO_USER.password,
      }),
      cache: 'no-store',
    });

    if (loginResponse.ok) {
      return forwardAuthCookie(loginResponse, redirectTo, request);
    }

    const registerResponse = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEMO_USER),
      cache: 'no-store',
    });

    if (registerResponse.ok) {
      return forwardAuthCookie(registerResponse, redirectTo, request);
    }

    const retryLoginResponse = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: DEMO_USER.email,
        password: DEMO_USER.password,
      }),
      cache: 'no-store',
    });

    if (retryLoginResponse.ok) {
      return forwardAuthCookie(retryLoginResponse, redirectTo, request);
    }

    return NextResponse.redirect(new URL('/login?error=demo-login-failed', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=demo-login-unavailable', request.url));
  }
}
