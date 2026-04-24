import { Suspense } from 'react';
import { RegisterPageClient } from './register-client';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4 pb-12 pt-4">
          <p className="text-[var(--yamma-text-muted)]">Loading…</p>
        </div>
      }
    >
      <RegisterPageClient />
    </Suspense>
  );
}
