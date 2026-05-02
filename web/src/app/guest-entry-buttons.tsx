'use client';

import { useCallback, useState } from 'react';

export function GuestEntryButtons() {
  const [busy, setBusy] = useState<'buyer' | 'seller' | null>(null);

  const go = useCallback((role: 'buyer' | 'seller', href: string) => {
    setBusy(role);
    window.location.href = href;
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          go(
            'buyer',
            `/api/auth/guest-login?role=buyer&redirect=${encodeURIComponent('/?loggedIn=1')}`,
          )
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-button-secondary-bg)] px-4 py-2.5 text-base font-medium text-[var(--yamma-text)] transition-all duration-200 hover:bg-[var(--yamma-button-secondary-hover)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
      >
        {busy === 'buyer' ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--yamma-text-muted)] border-t-[var(--yamma-primary)]"
              aria-hidden
            />
            Signing you in…
          </span>
        ) : (
          'Enter as buyer guest'
        )}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          go(
            'seller',
            `/api/auth/guest-login?role=seller&redirect=${encodeURIComponent('/seller/orders')}`,
          )
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] px-4 py-2.5 text-base font-medium text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
      >
        {busy === 'seller' ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--yamma-text-muted)] border-t-[var(--yamma-primary)]"
              aria-hidden
            />
            Signing you in…
          </span>
        ) : (
          'Enter as seller guest'
        )}
      </button>
    </div>
  );
}
