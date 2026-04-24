import { Suspense } from 'react';
import { CheckoutPageClient } from './checkout-client';

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="text-[var(--yamma-text-muted)]">Loading checkout…</p>
        </div>
      }
    >
      <CheckoutPageClient />
    </Suspense>
  );
}
