'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

const APP_SCHEME = 'yamma';

function parseResumeTarget(toParam: string | null): string | null {
  if (!toParam?.trim()) return null;
  let t = toParam.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== 'exp:' && u.protocol !== 'yamma:') return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * Lemon Squeezy redirects here over HTTPS after card checkout. The in-app browser
 * (`openAuthSessionAsync`) dismisses on this URL; we hand off via `to=` (Expo) or `yamma://`.
 */
function PaymentAppRedirectInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const restaurantId = searchParams.get('restaurantId');
  const to = searchParams.get('to');

  useEffect(() => {
    const resume = parseResumeTarget(to);
    if (resume) {
      window.location.replace(resume);
      return;
    }
    if (orderId?.trim()) {
      const rid = restaurantId?.trim();
      const q = rid
        ? `orderId=${encodeURIComponent(orderId.trim())}&restaurantId=${encodeURIComponent(rid)}`
        : `orderId=${encodeURIComponent(orderId.trim())}`;
      window.location.replace(`${APP_SCHEME}://payment-return?${q}`);
    }
  }, [orderId, restaurantId, to]);

  if (!orderId?.trim() && !parseResumeTarget(to)) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-[var(--yamma-text-muted)]">Missing return target.</p>
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
      <p className="mt-4 text-sm text-[var(--yamma-text-muted)]">
        If nothing happens, use the link your app showed, or open Yamma from the home screen.
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
