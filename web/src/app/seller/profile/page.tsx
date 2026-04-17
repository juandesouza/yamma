import Link from 'next/link';
import { redirect } from 'next/navigation';
import { YammaLogo } from '@yamma/design-system';
import { SELLER_GUEST_USER_EMAIL } from '@/lib/auth-constants';
import { getCurrentUser } from '@/lib/server-auth';
import { AppearanceThemeToggle } from '@/components/appearance-theme-toggle';
import { ProfileAccountActions } from '@/app/profile/profile-account-actions';
import { SellerRestaurantSetup } from '@/app/profile/seller-restaurant-setup';

export default async function SellerProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'restaurant') redirect('/');

  const isSellerGuest =
    user.email?.toLowerCase() === SELLER_GUEST_USER_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <Link
            href="/seller/orders"
            aria-label="Back to seller orders"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/" aria-label="Yamma home" className="flex items-center">
            <YammaLogo width={120} height={36} className="h-9 w-auto" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--yamma-text)]">Restaurant profile</h1>
        <p className="mt-2 mb-6 text-sm text-[var(--yamma-text-subtle)]">
          Update your restaurant details and menu.
        </p>
        <section className="mb-6">
          <AppearanceThemeToggle />
        </section>
        <section className="mb-6">
          <SellerRestaurantSetup />
        </section>
        {isSellerGuest ? (
          <section className="mt-10 rounded-3xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-6">
            <ProfileAccountActions
              canDeleteAccount={false}
              deleteBlockedHint="The shared guest account cannot be deleted. Log out when you are done browsing."
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
