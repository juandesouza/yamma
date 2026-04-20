'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@yamma/design-system';
import { clearCartIfAwaitingOrderPaid } from '@/lib/cart-storage';

const POLL_MS = 2000;
const MAX_POLLS = 90;

export default function CheckoutReturnPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const cancelled = searchParams.get('cancelled') === '1';
  const [status, setStatus] = useState<'waiting' | 'ready' | 'timeout' | 'error' | 'cancelled'>(
    cancelled ? 'cancelled' : 'waiting'
  );
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || cancelled) return;
    const oid = orderId;

    let pollCount = 0;
    let devConfirmAttempted = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${oid}`, { credentials: 'include' });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const data = await res.json();
        const s = typeof data?.status === 'string' ? data.status : null;
        setOrderStatus(s);
        if (s && s !== 'pending') {
          clearCartIfAwaitingOrderPaid(oid);
          setStatus('ready');
          if (timer) clearInterval(timer);
          window.location.replace(`/order/${oid}`);
          return;
        }
        if (s === 'pending' && pollCount >= 3 && !devConfirmAttempted) {
          devConfirmAttempted = true;
          const cr = await fetch('/api/payments/lemon/sync-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId: oid }),
          });
          if (cr.ok) {
            clearCartIfAwaitingOrderPaid(oid);
            setStatus('ready');
            if (timer) clearInterval(timer);
            window.location.replace(`/order/${oid}`);
            return;
          }
        }
        pollCount += 1;
        if (pollCount >= MAX_POLLS) {
          setStatus('timeout');
          if (timer) clearInterval(timer);
        }
      } catch {
        setStatus('error');
        if (timer) clearInterval(timer);
      }
    }

    poll();
    timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [orderId, cancelled]);

  if (!orderId) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-[var(--yamma-text-muted)]">Missing order reference.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--yamma-primary)] underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-4 text-xl font-semibold text-[var(--yamma-text)]">Payment cancelled</h1>
        <p className="mb-6 text-[var(--yamma-text-muted)]">
          Your order is still pending. You can open the order page to try again later or contact support.
        </p>
        <Link href={`/order/${orderId}`}>
          <Button fullWidth>View order</Button>
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="mb-4 text-[#ef4444]">Could not load your order.</p>
        <Link href={`/order/${orderId}`}>
          <Button fullWidth variant="secondary">
            View order
          </Button>
        </Link>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-4 text-xl font-semibold text-[var(--yamma-text)]">Still confirming payment</h1>
        <p className="mb-2 text-[var(--yamma-text-muted)]">
          This can take a minute while we wait for confirmation from your payment provider.
          {orderStatus ? ` Current status: ${orderStatus}.` : ''}
        </p>
        <Link href={`/order/${orderId}`}>
          <Button fullWidth>Go to order status</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--yamma-primary)] border-t-transparent" />
      <p className="text-[var(--yamma-text)]">Confirming your payment…</p>
      <p className="mt-2 text-sm text-[var(--yamma-text-muted)]">You will be redirected when your order is confirmed.</p>
    </div>
  );
}
