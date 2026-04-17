'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@yamma/design-system';
import { cartSubtotal, loadCart, type StoredCartLine } from '@/lib/cart-storage';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [items, setItems] = useState<StoredCartLine[]>([]);

  useEffect(() => {
    if (!id) return;
    setItems(loadCart(id));
  }, [id]);

  const subtotal = id ? cartSubtotal(id) : 0;
  const deliveryFee = 5;
  const total = subtotal + deliveryFee;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-[var(--yamma-text)]">Your cart</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-[var(--yamma-text-muted)]">Cart is empty. Add dishes from the menu.</p>
      ) : (
        <ul className="mt-6 space-y-3 rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-4">
          {items.map((row) => (
            <li
              key={row.menuItemId}
              className="flex justify-between gap-4 border-b border-[var(--yamma-border)] py-2 last:border-0"
            >
              <span className="text-[var(--yamma-text)]">
                {row.quantity}× {row.name}
              </span>
              <span className="font-medium text-[var(--yamma-primary)]">
                {fmt(row.quantity * parseFloat(row.unitPrice))}
              </span>
            </li>
          ))}
          <li className="flex justify-between pt-2 text-[var(--yamma-text-subtle)]">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </li>
          <li className="flex justify-between text-[var(--yamma-text-subtle)]">
            <span>Delivery estimate</span>
            <span>{fmt(deliveryFee)}</span>
          </li>
          <li className="flex justify-between border-t border-[var(--yamma-border-muted)] pt-3 text-lg font-semibold text-[var(--yamma-text)]">
            <span>Total</span>
            <span className="text-[var(--yamma-primary)]">{fmt(total)}</span>
          </li>
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => router.push(`/restaurant/${id}`)}>
          Continue shopping
        </Button>
        {items.length > 0 ? (
          <Button onClick={() => router.push(`/checkout?restaurant=${encodeURIComponent(id)}`)}>
            Go to checkout
          </Button>
        ) : null}
      </div>
      </div>
    </div>
  );
}
