import Link from 'next/link';
import { redirect } from 'next/navigation';
import { YammaLogo } from '@yamma/design-system';
import { SELLER_GUEST_USER_EMAIL } from '@/lib/auth-constants';
import { getCurrentUser, getSellerRestaurantState } from '@/lib/server-auth';
import { SellerRestaurantSetup } from '@/app/profile/seller-restaurant-setup';
import { SellerSetupRefresh } from './seller-setup-refresh';

export default async function SellerSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'restaurant') redirect('/');

  const seller = await getSellerRestaurantState();
  if (seller.hasRestaurant && seller.hasMenuItems) {
    redirect('/seller/orders');
  }

  const isSellerGuest = user.email?.toLowerCase() === SELLER_GUEST_USER_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <Link href="/" aria-label="Yamma home" className="flex items-center">
            <YammaLogo width={120} height={36} className="h-9 w-auto" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--yamma-text)]">Set up your restaurant</h1>
        {!isSellerGuest ? (
          <p className="mt-2 mb-6 text-sm text-[var(--yamma-text-subtle)]">
            Before opening the seller dashboard, add your place information and at least one meal.
          </p>
        ) : (
          <div className="mb-6 mt-4 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-4 py-3 text-sm text-[var(--yamma-text-muted)]">
            <p className="font-medium text-[var(--yamma-text-secondary)]">Seller guest (demo)</p>
            <p className="mt-1">
              A Washington, DC demo restaurant (same map area as buyer guest) with menu and photos is created for
              this account. If you still see this screen, reload once so we can load it — or go to{' '}
              <Link href="/seller/orders" className="font-medium text-[var(--yamma-primary)] underline">
                Seller orders
              </Link>{' '}
              after reloading.
            </p>
            <SellerSetupRefresh />
          </div>
        )}
        <SellerRestaurantSetup />
      </main>
    </div>
  );
}
