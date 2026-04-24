'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@yamma/design-system';
import { useEffect, useState } from 'react';
import { MapAssistedAddressField, type GeoCoords } from '@/components/map-assisted-address-field';
import { loadCart, setAwaitingPaymentCartClear } from '@/lib/cart-storage';

type PaymentOrder = {
  id: string;
  total: string;
  currency: string;
};

export function CheckoutPageClient() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('restaurant');
  const [address, setAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<GeoCoords | null>(null);
  const [step, setStep] = useState<'address' | 'payment'>('address');
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setIsGuest(Boolean(data?.isGuest));
      })
      .catch(() => {
        if (!cancelled) setIsGuest(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleContinueToPayment() {
    setSubmitError('');
    if (!address.trim()) return;
    if (!deliveryCoords) {
      setSubmitError('Select your delivery address from the map helper so we can save accurate coordinates.');
      return;
    }
    if (!restaurantId) {
      setSubmitError('Missing restaurant. Open checkout from a restaurant cart.');
      return;
    }
    const cart = loadCart(restaurantId);
    if (!cart.length) {
      setSubmitError('Your cart is empty. Add items from the menu first.');
      return;
    }
    const orderItems = cart.map((row) => ({
      menuItemId: row.menuItemId,
      quantity: row.quantity,
      name: row.name,
      unitPrice: row.unitPrice,
    }));
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          restaurantId,
          deliveryAddress: address,
          deliveryLatitude: deliveryCoords.lat,
          deliveryLongitude: deliveryCoords.lng,
          items: orderItems,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
              ? data.message[0]
              : 'You are not allowed to place this order.';
        setSubmitError(msg);
        return;
      }
      if (!data?.id) {
        setSubmitError(typeof data?.message === 'string' ? data.message : 'Could not create order.');
        return;
      }
      setAwaitingPaymentCartClear(data.id as string, restaurantId);
      setPaymentOrder({
        id: data.id as string,
        total: String(data.total ?? ''),
        currency: String(data.currency ?? 'USD'),
      });
      setStep('payment');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayWithCard() {
    if (!paymentOrder) return;
    setSubmitError('');
    setPayLoading(true);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: paymentOrder.id, provider: 'lemon_squeeze' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : Array.isArray(data?.message)
              ? data.message.join(', ')
              : 'Payment could not be started.';
        setSubmitError(msg);
        return;
      }
      const url = typeof data?.checkoutUrl === 'string' ? data.checkoutUrl : data?.redirectUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      setSubmitError('No checkout URL returned. Check that payment keys are configured on the server.');
    } finally {
      setPayLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--yamma-text)]">Checkout</h1>
      {isGuest === true && (
        <p className="mb-4 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-3 py-2 text-sm text-[var(--yamma-text-muted)]">
          You&apos;re using guest mode: orders use the shared demo buyer account. For your own order history,{' '}
          <Link href="/register" className="font-medium text-[var(--yamma-primary)] underline">
            sign up
          </Link>{' '}
          or{' '}
          <Link href="/login" className="font-medium text-[var(--yamma-primary)] underline">
            log in
          </Link>
          .
        </p>
      )}

      {step === 'address' && (
        <>
          <p className="mb-3 text-sm text-[var(--yamma-text-muted)]">
            Search or use your location, then pick the correct street — same as restaurant signup.
          </p>
          <MapAssistedAddressField
            address={address}
            onAddressChange={setAddress}
            coords={deliveryCoords}
            onCoordsChange={setDeliveryCoords}
          />
          {submitError && (
            <p className="mt-3 max-h-36 overflow-y-auto break-words text-sm text-[#ef4444]">{submitError}</p>
          )}
          <Button className="mt-6 w-full" onClick={handleContinueToPayment} loading={loading}>
            Continue to payment
          </Button>
        </>
      )}

      {step === 'payment' && paymentOrder && (
        <>
          <p className="mb-4 text-[var(--yamma-text-muted)]">
            Order total:{' '}
            <span className="font-medium text-[var(--yamma-text)]">
              {paymentOrder.currency} {paymentOrder.total}
            </span>
          </p>
          <p className="mb-4 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-3 py-2 text-sm text-[var(--yamma-text-muted)]">
            Pay securely with your card. Checkout is processed by Lemon Squeezy.
          </p>
          {submitError && (
            <p className="mb-4 max-h-36 overflow-y-auto break-words text-sm text-[#ef4444]">{submitError}</p>
          )}
          <div className="flex flex-col gap-3">
            <Button className="w-full" onClick={() => void handlePayWithCard()} loading={payLoading}>
              Pay with card
            </Button>
            <p className="text-center text-xs text-[var(--yamma-placeholder)]">
              Card checkout uses Lemon Squeezy.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
