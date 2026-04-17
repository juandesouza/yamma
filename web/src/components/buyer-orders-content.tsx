import Link from 'next/link';
import type { UserOrder } from '@/lib/server-auth';

const ACTIVE_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_transit',
  'preparing',
  'ready',
  'picked_up',
]);

function formatOrderStatus(status: string) {
  return status.replace('_', ' ');
}

function formatOrderDate(value?: string) {
  if (!value) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatOrderTotal(order: UserOrder) {
  if (!order.total) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: order.currency ?? 'USD',
  }).format(Number(order.total));
}

function OrderCard({ order }: { order: UserOrder }) {
  return (
    <Link
      href={`/order/${order.id}`}
      className="block rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-4 transition-all duration-200 hover:border-[var(--yamma-border-muted)] hover:shadow-[0_8px_24px_var(--yamma-shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--yamma-text-muted)]">{formatOrderDate(order.createdAt)}</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--yamma-text)]">Order #{order.id.slice(0, 8)}</h3>
          <p className="mt-1 text-sm text-[var(--yamma-text-muted)]">{order.deliveryAddress}</p>
        </div>
        <span className="rounded-full border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--yamma-text-secondary)]">
          {formatOrderStatus(order.status)}
        </span>
      </div>
      {formatOrderTotal(order) && (
        <p className="mt-4 text-sm font-medium text-[var(--yamma-primary)]">{formatOrderTotal(order)}</p>
      )}
    </Link>
  );
}

export function BuyerOrdersContent({ orders }: { orders: UserOrder[] }) {
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.has(order.status));
  const historyOrders = orders.filter((order) => !ACTIVE_STATUSES.has(order.status));

  return (
    <>
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--yamma-text)]">Orders in progress</h2>
        </div>
        {activeOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-5 py-8 text-center text-[var(--yamma-text-muted)]">
            No orders at the moment
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--yamma-text)]">Order history</h2>
        </div>
        {historyOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-5 py-8 text-center text-[var(--yamma-text-muted)]">
            No past orders yet
          </div>
        ) : (
          <div className="space-y-4">
            {historyOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
