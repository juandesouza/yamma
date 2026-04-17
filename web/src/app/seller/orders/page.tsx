import Link from 'next/link';
import { redirect } from 'next/navigation';
import { YammaLogo } from '@yamma/design-system';
import { getCurrentUser, getSellerRestaurantState } from '@/lib/server-auth';
import { SellerOrdersBoard } from './seller-orders-board';

export default async function SellerOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'restaurant') redirect('/');
  const seller = await getSellerRestaurantState();
  if (!seller.hasRestaurant || !seller.hasMenuItems) {
    redirect('/seller/setup');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/" aria-label="Yamma home" className="flex items-center">
            <YammaLogo width={120} height={36} className="h-9 w-auto" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--yamma-text-secondary)]">
              Seller
            </span>
            <Link
              href="/seller/profile"
              aria-label="Open restaurant profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M4 21C4 17.6863 7.58172 15 12 15C16.4183 15 20 17.6863 20 21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--yamma-text)]">Incoming orders</h1>
        <p className="mt-2 text-sm text-[var(--yamma-text-subtle)]">
          New paid orders appear here automatically. Mark an order ready to dispatch and notify the delivery app.
        </p>
        <SellerOrdersBoard />
      </main>
    </div>
  );
}
