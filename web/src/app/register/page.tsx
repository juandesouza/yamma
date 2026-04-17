'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@yamma/design-system';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountType, setAccountType] = useState<'buyer' | 'seller'>('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const urlError = searchParams.get('error');
  const urlErrorMessage =
    urlError?.startsWith('google-')
      ? 'Google sign-up failed. Please try again, or use email registration.'
      : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { name, email, password, accountType };
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.message === 'Internal server error'
            ? 'Registration is temporarily unavailable. Please check the backend database configuration.'
            : (data?.message ?? 'Registration failed')
        );
        return;
      }
      setSuccess('Succeed! Your account has been created. Redirecting to login...');
      window.setTimeout(() => {
        router.push('/login?registered=1');
        router.refresh();
      }, 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4 pb-12 pt-4">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--yamma-text)]">Sign up</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-[var(--yamma-text-subtle)]">I want to use Yamma to</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('buyer')}
              className={`rounded-2xl border p-3 text-left transition-all ${
                accountType === 'buyer'
                  ? 'border-[var(--yamma-primary)] bg-[#2a1a12] text-white'
                  : 'border-[var(--yamma-border)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] hover:border-[var(--yamma-border-muted)]'
              }`}
            >
              <div className="mb-1 text-lg" aria-hidden="true">🍽️</div>
              <p className="text-sm font-semibold">Buy food</p>
              <p
                className={
                  accountType === 'buyer' ? 'text-xs text-white/75' : 'text-xs text-[var(--yamma-text-subtle)]'
                }
              >
                Order from restaurants
              </p>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('seller')}
              className={`rounded-2xl border p-3 text-left transition-all ${
                accountType === 'seller'
                  ? 'border-[var(--yamma-primary)] bg-[#2a1a12] text-white'
                  : 'border-[var(--yamma-border)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] hover:border-[var(--yamma-border-muted)]'
              }`}
            >
              <div className="mb-1 text-lg" aria-hidden="true">🏪</div>
              <p className="text-sm font-semibold">Sell food</p>
              <p
                className={
                  accountType === 'seller' ? 'text-xs text-white/75' : 'text-xs text-[var(--yamma-text-subtle)]'
                }
              >
                Manage restaurant orders
              </p>
            </button>
          </div>
        </div>

        <Input
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
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
          minLength={8}
          fullWidth
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          fullWidth
        />
        {urlErrorMessage && !error && <p className="mb-2 text-sm text-amber-400">{urlErrorMessage}</p>}
        {error && <p className="text-sm text-[#ef4444]">{error}</p>}
        {success && <p className="text-sm text-[#22c55e]">{success}</p>}
        <Button type="submit" fullWidth loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--yamma-text-muted)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--yamma-primary)] hover:underline">Log in</Link>
      </p>
      <p className="mt-6 text-center text-sm text-[var(--yamma-text-muted)]">or</p>
      <a
        href="/api/auth/google?from=register"
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
