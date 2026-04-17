'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { clearCartIfAwaitingOrderPaid } from '@/lib/cart-storage';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

type OrderRow = {
  id: string;
  status: string;
  total?: string;
  courierRequestedAt?: string | null;
};

/** Buyer-facing tracker: pending → confirmed → on the way (maps legacy statuses into these steps). */
function buyerStepIndex(status: string): number {
  if (status === 'pending') return 0;
  if (status === 'in_transit' || status === 'picked_up' || status === 'delivered') return 2;
  return 1;
}

const STEPS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending payment' },
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'in_transit', label: 'On the way' },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [handoffNotice, setHandoffNotice] = useState(false);

  useEffect(() => {
    let socket: Socket | null = null;

    async function fetchOrder() {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as OrderRow;
        setOrder(data);
        if (data.courierRequestedAt) setHandoffNotice(true);
      }
      setLoading(false);
    }

    void fetchOrder();

    try {
      socket = io(WS_BASE, {
        transports: ['websocket', 'polling'],
        path: '/socket.io/',
      });
      socket.on('connect', () => {
        socket?.emit('subscribe:order', { orderId: id });
      });
      socket.on('order:status', (msg: { orderId?: string; status?: string }) => {
        if (msg?.orderId === id && msg.status) {
          setOrder((o) => (o ? { ...o, status: msg.status! } : o));
        }
      });
      socket.on('order:courier_handoff', (msg: { orderId?: string }) => {
        if (msg?.orderId === id) {
          setHandoffNotice(true);
          setOrder((o) => (o ? { ...o, courierRequestedAt: new Date().toISOString() } : o));
        }
      });
    } catch {
      /* socket optional */
    }

    return () => {
      socket?.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (!order || order.status === 'pending') return;
    clearCartIfAwaitingOrderPaid(order.id);
  }, [order?.id, order?.status]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--yamma-text)]">Loading…</div>
    );
  }
  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#ef4444]">Order not found</div>
    );
  }

  const currentIndex = buyerStepIndex(order.status);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--yamma-text)]">Order #{id.slice(0, 8)}</h1>
      <p className="mb-6 text-[var(--yamma-text-muted)]">Track your order status</p>
      {handoffNotice && currentIndex < 2 ? (
        <p className="mb-4 rounded-xl border border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-3 py-2 text-sm text-[var(--yamma-text-subtle)]">
          The restaurant sent your order to the delivery partner. You will see &quot;On the way&quot; when a driver
          accepts the trip.
        </p>
      ) : null}
      <div className="mb-8 rounded-2xl bg-[var(--yamma-surface)] p-4">
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  i <= currentIndex ? 'bg-[var(--yamma-primary)]' : 'bg-[var(--yamma-button-secondary-bg)]'
                }`}
              />
              <span
                className={
                  i <= currentIndex ? 'text-[var(--yamma-text)]' : 'text-[var(--yamma-placeholder)]'
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      {order.total ? (
        <p className="mb-4 text-[var(--yamma-text-muted)]">Total: {order.total}</p>
      ) : null}
    </div>
  );
}
