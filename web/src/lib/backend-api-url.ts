/**
 * Nest API origin for Next.js route handlers (server-side fetch).
 * Defaults to 3002 when unset — align with `pnpm dev:backend` / `NEXT_PUBLIC_API_URL`.
 */
export const BACKEND_API_URL =
  typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
    ? process.env.NEXT_PUBLIC_API_URL.trim()
    : 'http://localhost:3002';
