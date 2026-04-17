import Link from 'next/link';
import { redirect } from 'next/navigation';
import { YammaLogo } from '@yamma/design-system';
import { getCurrentUser } from '@/lib/server-auth';
import { AdminUsersPanel } from './users-panel';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link
            href="/"
            aria-label="Back to home"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/" aria-label="Yamma home" className="flex items-center">
            <YammaLogo width={120} height={36} className="h-9 w-auto" />
          </Link>
          <span className="ml-auto rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--yamma-text-secondary)]">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--yamma-text)]">Platform management</h1>
        <p className="mt-2 text-sm text-[var(--yamma-text-subtle)]">
          Monitor buyers and sellers, then update roles as needed.
        </p>
        <AdminUsersPanel />
      </main>
    </div>
  );
}
