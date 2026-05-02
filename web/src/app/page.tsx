import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@yamma/design-system';
import { getCurrentUser, getSellerRestaurantState } from '@/lib/server-auth';
import { GuestEntryButtons } from './guest-entry-buttons';
import { HomeRestaurantGrid } from './home-restaurant-grid';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ signedUp?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const currentUser = await getCurrentUser();
  if (currentUser?.role === 'restaurant') {
    const seller = await getSellerRestaurantState();
    if (!seller.hasRestaurant || !seller.hasMenuItems) {
      redirect('/seller/setup');
    }
    redirect('/seller/orders');
  }
  const loggedIn = Boolean(currentUser);

  return (
    <div className="min-h-screen">
      {resolvedSearchParams.signedUp === '1' && loggedIn && (
        <div className="border-b border-[var(--yamma-border)] bg-[var(--yamma-popover)]">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="inline-flex items-center rounded-full border border-[#1c6b3a] bg-[#12351f] px-3 py-1.5 text-sm text-[#d9ffe5]">
              Succeed! You are now logged in as
              <span className="ml-1 font-semibold">{currentUser?.name}</span>.
            </div>
          </div>
        </div>
      )}
      <main
        className={`mx-auto px-4 py-8 ${loggedIn ? 'max-w-5xl' : 'max-w-4xl'}`}
      >
        {!loggedIn ? (
          <div className="mx-auto max-w-md">
            <h1 className="mb-2 text-2xl font-semibold text-[var(--yamma-text)]">Welcome to Yamma</h1>
            <p className="mb-8 text-[var(--yamma-text-subtle)]">
              Sign in to see restaurants near you, or enter as a guest to browse without an account.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/login" className="sm:flex-1">
                <Button fullWidth>Log in with email</Button>
              </Link>
              <Link href="/register" className="sm:flex-1">
                <Button variant="secondary" fullWidth>
                  Sign up with email
                </Button>
              </Link>
            </div>
            <p className="my-6 text-center text-sm text-[var(--yamma-text-muted)]">or</p>
            <a
              href="/api/auth/google"
              className="mb-10 flex w-full items-center justify-center gap-2 rounded-xl border border-[#3d3f4a] bg-white px-4 py-2.5 text-base font-medium text-[#1f1f1f] shadow-sm transition-all duration-200 hover:bg-[#f3f4f6] active:scale-[0.99]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </a>
            <p className="mb-3 text-center text-sm text-[var(--yamma-text-secondary)]">
              If you want to try the app without signing up, choose a guest mode
            </p>
            <GuestEntryButtons />
          </div>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-[var(--yamma-text)]">Restaurants near you</h1>
            <p className="mb-6 text-[var(--yamma-text-muted)]">
              We use your device location when you allow it, then list places{' '}
              <strong className="text-[var(--yamma-text-secondary)]">nearest first</strong>. Distance is shown in{' '}
              <strong className="text-[var(--yamma-text-secondary)]">miles</strong>.
            </p>
            <HomeRestaurantGrid />
          </>
        )}
      </main>
    </div>
  );
}
