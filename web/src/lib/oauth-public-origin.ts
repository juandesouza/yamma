import type { NextRequest } from 'next/server';

/**
 * Single canonical origin for OAuth `redirect_uri` (authorize + token exchange must match exactly).
 * Fixes ::1 vs localhost mismatches with Google Cloud "Authorized redirect URIs".
 */
export function oauthPublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.OAUTH_PUBLIC_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const { protocol, hostname, port } = request.nextUrl;
  const host =
    hostname === '::1' || hostname === '[::1]' ? 'localhost' : hostname;
  const portPart = port ? `:${port}` : '';
  return `${protocol}//${host}${portPart}`;
}
