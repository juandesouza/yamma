'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, MenuItemCard } from '@yamma/design-system';
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

  useEffect(() => {
    setCartCount(cartLineCount(restaurantId));
  }, [restaurantId]);

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
                      onAdd={() => {
                        addCartLine(restaurantId, {
                          menuItemId: item.id,
                          name: item.name,
                          unitPrice,
                        });
                        setCartCount(cartLineCount(restaurantId));
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
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-sm">{cartCount}</span>
            ) : null}
          </Button>
        </Link>
      </div>
    </>
  );
}
