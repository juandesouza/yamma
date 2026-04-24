import { Suspense } from 'react';
import { CheckoutReturnPageClient } from './checkout-return-client';

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--yamma-primary)] border-t-transparent" />
          <p className="text-[var(--yamma-text-muted)]">Loading…</p>
        </div>
      }
    >
      <CheckoutReturnPageClient />
    </Suspense>
  );
}
