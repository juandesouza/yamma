import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@yamma/design-system';
import { isGuestUser } from '@/lib/auth-constants';
import { getCurrentUser } from '@/lib/server-auth';
import { AppearanceThemeToggle } from '@/components/appearance-theme-toggle';
import { ProfileAccountActions } from './profile-account-actions';
import { SellerRestaurantSetup } from './seller-restaurant-setup';

function formatBalance(value?: string, currency = 'USD') {
  const amount = Number(value ?? '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const guest = isGuestUser(user);
  const canDeleteAccount = !guest && user.role !== 'restaurant' && user.role !== 'admin';
  const deleteBlockedHint = guest
    ? 'The shared guest account cannot be deleted. Log out when you are done browsing.'
    : user.role === 'restaurant'
      ? 'Seller accounts cannot be deleted from the app. Contact support if you need to close your account.'
      : user.role === 'admin'
        ? 'Admin accounts cannot be deleted from the app.'
        : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8 rounded-3xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-6">
          <p className="text-sm text-[var(--yamma-text-muted)]">Profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--yamma-text)]">{user.name}</h1>
          <p className="mt-2 text-sm text-[var(--yamma-text-subtle)]">{user.email ?? 'No email available'}</p>
          {user.role === 'restaurant' && user.fiatBalance !== undefined && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-3 py-1.5">
              <span className="text-xs uppercase tracking-wide text-[var(--yamma-text-muted)]">
                Seller earnings (fiat)
              </span>
              <span className="text-sm font-semibold text-[var(--yamma-text)]">
                {formatBalance(user.fiatBalance)}
              </span>
            </div>
          )}
          {user.role === 'admin' && (
            <div className="mt-4">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--yamma-text-secondary)] transition-all hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)]"
              >
                <span aria-hidden="true">🛠️</span>
                Manage app
              </Link>
            </div>
          )}
        </section>

        <section className="mb-8">
          <AppearanceThemeToggle />
        </section>

        <section className="mb-10 flex flex-col items-center px-2">
          <div className="flex w-full max-w-md flex-col gap-3 md:max-w-lg">
            <Link href="/orders" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Orders
              </Button>
            </Link>
            {user.role === 'restaurant' ? (
              <Link href="/seller/orders" className="block w-full">
                <Button variant="secondary" size="lg" fullWidth>
                  Seller orders dashboard
                </Button>
              </Link>
            ) : null}
          </div>
        </section>

        {user.role === 'restaurant' && (
          <section className="mb-6">
            <SellerRestaurantSetup />
          </section>
        )}

        <section className="mt-10 rounded-3xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-6">
          <ProfileAccountActions
            canDeleteAccount={canDeleteAccount}
            deleteBlockedHint={deleteBlockedHint}
          />
        </section>
      </main>
    </div>
  );
}
