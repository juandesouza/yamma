'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@yamma/design-system';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const registered = searchParams.get('registered') === '1';
  const urlError = searchParams.get('error');
  const googleErrorMessages: Record<string, string> = {
    'google-state-mismatch': 'Google sign-in session expired. Close this tab and try “Continue with Google” again.',
    'google-bad-redirect':
      'OAuth redirect did not match this app URL. Add this exact redirect URI in Google Cloud: your site origin + /api/auth/google/callback (e.g. http://localhost:3000/api/auth/google/callback).',
    'google-token':
      'Google could not complete sign-in (token). Check that the redirect URI in Google Cloud matches the URL you use to open the app, including http vs https and host (localhost vs IP).',
    'google-token-used':
      'This sign-in link was already used or expired. Close the tab and click “Continue with Google” again. If you use both localhost and 127.0.0.1, pick one and set OAUTH_PUBLIC_ORIGIN in web/.env.local to match your Google redirect URI.',
    'google-server-error':
      'Something went wrong on the server during Google sign-in. Check the API logs; in development the error may include a short hint.',
    'google-email-not-verified': 'Verify your Google account email, then try again, or use email and password.',
    'google-userinfo': 'Could not read your Google profile. Try again or use email and password.',
    'google-email': 'Your Google account email could not be used. Try another account or use email and password.',
    'google-not-configured': 'Google sign-in is not configured on the server (missing client id/secret).',
    'google-missing-web-secret':
      'Web app is missing GOOGLE_CLIENT_SECRET (server env). Copy it from the backend .env into web/.env.local — same value, not NEXT_PUBLIC.',
    'google-api-unreachable':
      'Could not reach the API from the web server. Check INTERNAL_API_URL / NEXT_PUBLIC_API_URL and that the backend is running.',
    'google-sign-in-failed': 'Google sign-in failed. Please try again, or use email and password.',
  };
  const urlErrorMessage = urlError?.startsWith('google-')
    ? googleErrorMessages[urlError] ?? googleErrorMessages['google-sign-in-failed']
    : urlError === 'guest-login-failed' || urlError === 'guest-unavailable'
        ? 'Guest sign-in failed. Please try again or use email.'
        : urlError === 'demo-login-failed' || urlError === 'demo-login-unavailable'
          ? 'Demo sign-in failed. Please try again or register.'
          : urlError
            ? 'Something went wrong. Please try again.'
            : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? 'Login failed');
        return;
      }
      router.push(registered ? '/?signedUp=1' : '/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setError('');
    setResetMessage('');

    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email to receive the reset link.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? 'Could not start password reset.');
        return;
      }
      setResetMessage(
        data?.message ?? 'If an account exists for this email, we sent a reset link.',
      );
      setForgotEmail('');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4 pb-12 pt-4">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--yamma-text)]">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <p className="-mt-2 text-right text-sm">
          <button
            type="button"
            onClick={() => {
              setShowForgotForm((v) => !v);
              setError('');
              setResetMessage('');
            }}
            className="text-[var(--yamma-primary)] hover:underline"
          >
            Forgot password?
          </button>
        </p>
        {showForgotForm ? (
          <div className="rounded-xl border border-[#3d3f4a] bg-[#17181d] p-3">
            <Input
              label="Recovery email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              fullWidth
            />
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="mt-2 w-full rounded-lg bg-[var(--yamma-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {resetLoading ? 'Sending reset email...' : 'Send reset link'}
            </button>
          </div>
        ) : null}
        {registered && <p className="text-sm text-[#22c55e]">Succeed! You can now log in with your new account.</p>}
        {urlErrorMessage && !error && <p className="text-sm text-amber-400">{urlErrorMessage}</p>}
        {resetMessage && <p className="text-sm text-[#22c55e]">{resetMessage}</p>}
        {error && <p className="text-sm text-[#ef4444]">{error}</p>}
        <Button type="submit" fullWidth loading={loading}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--yamma-text-muted)]">
        Don’t have an account?{' '}
        <Link href="/register" className="text-[var(--yamma-primary)] hover:underline">Sign up</Link>
      </p>
      <p className="mt-6 text-center text-sm text-[var(--yamma-text-muted)]">or</p>
      <a
        href="/api/auth/google"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#3d3f4a] bg-white px-4 py-2.5 text-base font-medium text-[#1f1f1f] shadow-sm transition-all duration-200 hover:bg-[#f3f4f6] active:scale-[0.99]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </a>
    </div>
  );
}
