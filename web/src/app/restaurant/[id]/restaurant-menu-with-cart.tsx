'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, MenuItemCard, Toast } from '@yamma/design-system';
import { addCartLine, cartLineCount } from '@/lib/cart-storage';

type MenuItemRow = {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
};

type MenuRow = {
  id: string;
  name: string;
  items?: MenuItemRow[];
};

export function RestaurantMenuWithCart({
  restaurantId,
  menus,
}: {
  restaurantId: string;
  menus: MenuRow[];
}) {
  const [cartCount, setCartCount] = useState(0);
  const [addedItemIds, setAddedItemIds] = useState<Record<string, true>>({});
  const addTimersRef = useRef<Map<string, number>>(new Map());
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [cartBump, setCartBump] = useState(false);
  const prevCartRef = useRef<number | null>(null);

  useEffect(() => {
    setCartCount(cartLineCount(restaurantId));
  }, [restaurantId]);

  useEffect(() => {
    const timers = addTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const prev = prevCartRef.current;
    prevCartRef.current = cartCount;
    if (prev !== null && cartCount > prev) {
      setCartBump(true);
      const tid = window.setTimeout(() => setCartBump(false), 500);
      return () => window.clearTimeout(tid);
    }
    return undefined;
  }, [cartCount]);

  const hasItems = menus.some((m) => (m.items?.length ?? 0) > 0);

  if (!menus.length || !hasItems) {
    return (
      <>
        <p className="py-6 text-[var(--yamma-text-muted)]">
          No dishes are listed for this place yet. Seed sample menus from the repo root:
        </p>
        <code className="block rounded bg-[var(--yamma-surface)] px-3 py-2 text-xs text-[var(--yamma-text-secondary)]">
          pnpm --filter backend run seed:menus
        </code>
        <div className="mt-8 flex justify-center">
          <Link href={`/restaurant/${restaurantId}/cart`}>
            <Button variant="secondary">View cart & checkout</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4 sm:bottom-8">
          <div className="pointer-events-auto w-full max-w-sm shadow-xl">
            <Toast
              key={toast.id}
              message={toast.message}
              variant="success"
              duration={2600}
              onClose={() => setToast(null)}
            />
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        {menus.map((menu) => (
          <section key={menu.id}>
            <h3 className="mb-2 text-lg text-[var(--yamma-text-secondary)]">{menu.name}</h3>
            <ul className="space-y-2">
              {(menu.items ?? []).map((item) => {
                const priceNum = Number(item.price);
                const unitPrice = Number.isFinite(priceNum) ? priceNum.toFixed(2) : '0.00';
                return (
                  <li key={item.id}>
                    <MenuItemCard
                      id={item.id}
                      name={item.name}
                      description={item.description ?? undefined}
                      price={Number.isFinite(priceNum) ? priceNum : 0}
                      imageUrl={item.imageUrl ?? undefined}
                      currency="USD"
                      showAddedFeedback={Boolean(addedItemIds[item.id])}
                      onAdd={() => {
                        addCartLine(restaurantId, {
                          menuItemId: item.id,
                          name: item.name,
                          unitPrice,
                        });
                        setCartCount(cartLineCount(restaurantId));
                        const existing = addTimersRef.current.get(item.id);
                        if (existing) clearTimeout(existing);
                        setAddedItemIds((prev) => ({ ...prev, [item.id]: true }));
                        const tid = window.setTimeout(() => {
                          setAddedItemIds((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                          addTimersRef.current.delete(item.id);
                        }, 1400);
                        addTimersRef.current.set(item.id, tid);
                        setToast({ message: `${item.name} added to cart`, id: Date.now() });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <Link href={`/restaurant/${restaurantId}/cart`}>
          <Button>
            View cart & checkout
            {cartCount > 0 ? (
              <span
                className={[
                  'ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-sm tabular-nums transition-transform duration-150',
                  cartBump ? 'scale-110' : 'scale-100',
                ].join(' ')}
              >
                {cartCount}
              </span>
            ) : null}
          </Button>
        </Link>
      </div>
    </>
  );
}
