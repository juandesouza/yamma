'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@yamma/design-system';

type SellerOrder = {
  id: string;
  status: string;
  total?: string;
  currency?: string;
  deliveryAddress: string;
  restaurantName?: string;
  createdAt?: string;
  courierRequestedAt?: string | null;
};

export function SellerOrdersBoard() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/orders/restaurant', { credentials: 'include', cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (!res.ok || !Array.isArray(data)) {
      setError(typeof data?.message === 'string' ? data.message : 'Could not load orders');
      return;
    }
    setError('');
    setOrders(data as SellerOrder[]);

    const currentIds = new Set<string>(data.map((o: SellerOrder) => o.id));
    if (!firstLoadRef.current) {
      for (const id of currentIds) {
        if (!knownIdsRef.current.has(id)) {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('New order received', { body: `Order #${id.slice(0, 8)} is waiting.` });
          }
          break;
        }
      }
    }
    firstLoadRef.current = false;
    knownIdsRef.current = currentIds;
  }, []);

  useEffect(() => {
    let alive = true;
    void load().finally(() => {
      if (alive) setLoading(false);
    });
    const timer = setInterval(() => void load(), 5000);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);

  async function dispatch(orderId: string) {
    setDispatching(orderId);
    setError('');
    try {
      const res = await fetch(`/api/orders/${orderId}/dispatch`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.message === 'string' ? data.message : 'Could not dispatch order');
        return;
      }
      await load();
    } finally {
      setDispatching(null);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-[var(--yamma-text-muted)]">Loading seller orders…</p>;
  }

  return (
    <section className="mt-6">
      {error && <p className="mb-4 text-sm text-[#ef4444]">{error}</p>}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-5 py-8 text-center text-[var(--yamma-text-muted)]">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const canDispatch = o.status === 'confirmed' && !o.courierRequestedAt;
            const waitingDriver =
              o.status === 'confirmed' && Boolean(o.courierRequestedAt);
            return (
              <article key={o.id} className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--yamma-text)]">Order #{o.id.slice(0, 8)}</h3>
                    <p className="mt-1 text-sm text-[var(--yamma-text-subtle)]">{o.deliveryAddress}</p>
                    {o.total ? (
                      <p className="mt-1 text-sm text-[var(--yamma-text-muted)]">
                        Total: {o.currency ?? 'USD'} {o.total}
                      </p>
                    ) : null}
                    {waitingDriver ? (
                      <p className="mt-2 text-xs text-[var(--yamma-text-muted)]">
                        Waiting for a driver to accept (delivery partner notified).
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--yamma-text-secondary)]">
                    {o.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => void dispatch(o.id)}
                    loading={dispatching === o.id}
                    disabled={!canDispatch || dispatching !== null}
                  >
                    Ready and send to delivery
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
