'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@yamma/design-system';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Reset link is invalid. Request a new one from the login page.');
      return;
    }
    if (password.length < 8) {
      setError('Password must have at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? 'Could not reset password.');
        return;
      }
      setSuccess('Password updated successfully. You can now log in.');
      setPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4 pb-12 pt-4">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--yamma-text)]">Reset password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          fullWidth
        />
        {error ? <p className="text-sm text-[#ef4444]">{error}</p> : null}
        {success ? <p className="text-sm text-[#22c55e]">{success}</p> : null}
        <Button type="submit" fullWidth loading={loading}>
          Update password
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--yamma-text-muted)]">
        Back to <Link href="/login" className="text-[var(--yamma-primary)] hover:underline">log in</Link>
      </p>
    </div>
  );
}
