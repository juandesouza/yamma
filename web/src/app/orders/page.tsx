import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@yamma/design-system';
import { getCurrentUser, getUserOrders } from '@/lib/server-auth';
import { BuyerOrdersContent } from '@/components/buyer-orders-content';

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const orders = await getUserOrders();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-10 flex flex-col items-center gap-5 text-center">
          <div>
            <p className="text-sm text-[var(--yamma-text-muted)]">Your purchases</p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--yamma-text)]">Orders</h1>
          </div>
          <Link href="/profile" className="block w-full max-w-md md:max-w-lg">
            <Button variant="secondary" size="lg" fullWidth>
              Back to profile
            </Button>
          </Link>
        </div>

        <BuyerOrdersContent orders={orders} />
      </main>
    </div>
  );
}
