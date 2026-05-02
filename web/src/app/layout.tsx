import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import { ThemeProvider } from '@yamma/design-system';
import { AppTopBar } from '@/components/app-top-bar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yamma – Food Delivery',
  description: 'Order food from your favorite restaurants',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {apiOrigin ? (
          <>
            <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={apiOrigin} />
          </>
        ) : null}
      </head>
      <body>
        <Script id="yamma-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('yamma-color-mode');document.documentElement.setAttribute('data-theme',t==='light'||t==='dark'?t:'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`}
        </Script>
        <ThemeProvider>
          <Suspense fallback={<div className="h-14 border-b border-[var(--yamma-border)] bg-[var(--yamma-header-bg)]" aria-hidden />}>
            <AppTopBar />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
