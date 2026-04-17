'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

/** Must match `scheme` in `mobile/app.config.js`. */
const APP_SCHEME = 'yamma';

/**
 * Lemon Squeezy redirects here over HTTPS after card checkout. The in-app browser
 * (`openAuthSessionAsync`) dismisses on this URL; we immediately hand off to the native app.
 */
function PaymentAppRedirectInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (!orderId?.trim()) return;
    const target = `${APP_SCHEME}://payment-return?orderId=${encodeURIComponent(orderId.trim())}`;
    window.location.replace(target);
  }, [orderId]);

  if (!orderId?.trim()) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-[var(--yamma-text-muted)]">Missing order reference.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--yamma-primary)] underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--yamma-primary)] border-t-transparent" />
      <p className="text-[var(--yamma-text)]">Returning to the app…</p>
      <p className="mt-2 text-sm text-[var(--yamma-text-muted)]">
        If nothing happens, close this tab and open Yamma — your order is saved.
      </p>
    </div>
  );
}

export default function PaymentAppRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-4">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--yamma-primary)] border-t-transparent" />
        </div>
      }
    >
      <PaymentAppRedirectInner />
    </Suspense>
  );
}
