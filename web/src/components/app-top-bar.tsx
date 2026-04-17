'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, YammaLogo } from '@yamma/design-system';

function resolveBackHref(pathname: string, search: string): string | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) return null;

  if (pathname.startsWith('/restaurant/')) {
    if (pathname.endsWith('/cart')) {
      const parts = pathname.split('/').filter(Boolean);
      const restaurantId = parts[1];
      return restaurantId ? `/restaurant/${restaurantId}` : '/';
    }
    return '/';
  }
  if (pathname === '/checkout') {
    const r = new URLSearchParams(search).get('restaurant');
    return r ? `/restaurant/${r}/cart` : '/';
  }
  if (pathname === '/profile') return '/';
  if (pathname === '/login' || pathname === '/register') return '/';
  if (pathname.startsWith('/order/')) return '/profile';
  return '/';
}

const backArrow = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M15 18L9 12L15 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function AppTopBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLoggedIn(Boolean(d?.user));
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) {
    return null;
  }

  const backHref = resolveBackHref(pathname, search);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)] hover:shadow-[0_0_18px_rgba(255,85,0,0.18)] active:scale-95"
          >
            {backArrow}
          </Link>
        ) : null}
        <Link href="/" aria-label="Yamma home" className="flex min-w-0 items-center">
          <YammaLogo width={120} height={36} className="h-9 w-auto" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {loggedIn && pathname !== '/profile' ? (
            <Link
              href="/profile"
              aria-label="Open profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface)] text-[var(--yamma-text-secondary)] transition-all duration-200 hover:border-[var(--yamma-primary)] hover:text-[var(--yamma-text)] hover:shadow-[0_0_18px_rgba(255,85,0,0.18)]"
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
          ) : null}
          {!loggedIn && pathname !== '/login' && pathname !== '/register' ? (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          ) : null}
          {pathname === '/login' ? (
            <Link href="/register">
              <Button size="sm">Sign up</Button>
            </Link>
          ) : null}
          {pathname === '/register' ? (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
