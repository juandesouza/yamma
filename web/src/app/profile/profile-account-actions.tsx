'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@yamma/design-system';

export function ProfileAccountActions({
  canDeleteAccount,
  deleteBlockedHint,
}: {
  canDeleteAccount: boolean;
  /** Shown when delete is not offered (guest, seller, admin). */
  deleteBlockedHint?: string | null;
}) {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/');
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    const ok = window.confirm(
      'Delete your account permanently? This cannot be undone. Your order history will be removed.'
    );
    if (!ok) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
              ? data.message[0]
              : 'Could not delete account.';
        setDeleteError(msg);
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md md:max-w-lg">
      <h2 className="text-center text-sm font-medium text-[var(--yamma-text-subtle)]">Account</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Button variant="secondary" size="lg" fullWidth loading={logoutLoading} onClick={handleLogout}>
          Log out
        </Button>
        {canDeleteAccount ? (
          <Button variant="danger" size="lg" fullWidth loading={deleteLoading} onClick={handleDeleteAccount}>
            Delete account
          </Button>
        ) : null}
      </div>
      {!canDeleteAccount && deleteBlockedHint ? (
        <p className="mt-4 text-center text-sm text-[var(--yamma-text-muted)]">{deleteBlockedHint}</p>
      ) : null}
      {deleteError ? (
        <p className="mt-3 text-center text-sm text-[#ef4444]">{deleteError}</p>
      ) : null}
    </div>
  );
}
