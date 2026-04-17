'use client';

import { useEffect } from 'react';
import { Button } from '@yamma/design-system';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-xl font-semibold text-[var(--yamma-text)]">Something went wrong</h1>
      <p className="mb-6 text-center text-[var(--yamma-text-muted)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
        <Link href="/">
          <Button variant="ghost">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
