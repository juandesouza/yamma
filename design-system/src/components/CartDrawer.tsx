'use client';

import React from 'react';

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

export interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee?: number;
  currency?: string;
  onCheckout?: () => void;
  children?: React.ReactNode;
}

export function CartDrawer({
  open,
  onClose,
  items,
  subtotal,
  deliveryFee = 0,
  currency = 'USD',
  onCheckout,
  children,
}: CartDrawerProps) {
  const total = subtotal + deliveryFee;
  const format = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(n);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Cart"
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--yamma-border)] bg-[var(--yamma-surface)] shadow-[0_8px_32px_var(--yamma-shadow-soft)] animate-in slide-in-from-right duration-300"
      >
        <div className="flex items-center justify-between border-b border-[var(--yamma-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--yamma-text)]">Your cart</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--yamma-text-muted)] transition-colors hover:bg-[var(--yamma-button-secondary-bg)] hover:text-[var(--yamma-text)]"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-[var(--yamma-text-muted)]">Cart is empty</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border-b border-[var(--yamma-border)] py-2 last:border-0"
                >
                  <span className="text-[var(--yamma-text)]">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-medium text-[var(--yamma-primary)]">
                    {format(item.quantity * item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
        <div className="space-y-2 border-t border-[var(--yamma-border)] p-4">
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm text-[var(--yamma-text-muted)]">
              <span>Delivery</span>
              <span>{format(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold text-[var(--yamma-text)]">
            <span>Total</span>
            <span>{format(total)}</span>
          </div>
          <button
            type="button"
            onClick={onCheckout}
            disabled={items.length === 0}
            className="mt-2 w-full rounded-xl bg-[var(--yamma-primary)] py-3 font-semibold text-white transition-all hover:bg-[var(--yamma-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
