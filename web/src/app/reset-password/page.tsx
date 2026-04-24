import { Suspense } from 'react';
import { ResetPasswordPageClient } from './reset-password-client';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4 pb-12 pt-4">
          <p className="text-[var(--yamma-text-muted)]">Loading…</p>
        </div>
      }
    >
      <ResetPasswordPageClient />
    </Suspense>
  );
}
