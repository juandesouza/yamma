import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createDb } from '../db';
import { payments, orders, users, restaurants } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { LemonSqueezeProvider } from './providers/lemon-squeeze.provider';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  private db = createDb(process.env.DATABASE_URL!);

  constructor(
    private lemon: LemonSqueezeProvider,
    private orders: OrdersService,
  ) {}

  getProvider() {
    return this.lemon;
  }

  /** Credits restaurant owner's fiat balance (card settlements). */
  private async creditRestaurantOwner(tx: typeof this.db, order: (typeof orders.$inferSelect)) {
    const [r] = await tx.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    if (!r) return;
    const [owner] = await tx.select().from(users).where(eq(users.id, r.ownerId)).limit(1);
    if (!owner) return;
    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) return;
    const fiatPart = Math.round(total * 100) / 100;
    const of = Number(owner.fiatBalance ?? 0);
    await tx
      .update(users)
      .set({
        fiatBalance: (of + fiatPart).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(users.id, owner.id));
  }

  async createPayment(
    orderId: string,
    provider: string,
    userId: string,
    checkoutSuccessTarget?: 'web' | 'mobile',
  ) {
    if (provider !== 'lemon_squeeze') {
      throw new BadRequestException('Only card checkout (Lemon Squeezy) is available.');
    }

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== 'pending') {
      throw new ForbiddenException('This order is not awaiting payment');
    }
    const amount = Number(order.total);
    const currency = order.currency ?? 'USD';
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ForbiddenException('Invalid order total');
    }

    let result: Awaited<ReturnType<LemonSqueezeProvider['createPayment']>>;
    try {
      result = await this.lemon.createPayment({
        orderId,
        amount,
        currency,
        checkoutSuccessTarget,
      });
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Payment provider error';
      if (msg.length > 600) msg = `${msg.slice(0, 597)}…`;
      if (/not configured/i.test(msg)) {
        throw new ServiceUnavailableException(msg);
      }
      throw new BadGatewayException(msg);
    }
    await this.db.insert(payments).values({
      orderId,
      provider: 'lemon_squeeze',
      providerPaymentId: result.providerPaymentId,
      status: result.status,
      amount: amount.toFixed(2),
      currency,
    });
    return result;
  }

  async confirmPayment(orderId: string, status: 'completed' | 'failed') {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    await this.db
      .update(payments)
      .set({
        status: status === 'completed' ? 'completed' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(payments.orderId, orderId));

    if (status === 'completed' && order.status === 'pending') {
      await this.db.transaction(async (tx) => {
        await this.creditRestaurantOwner(tx, order);
        await tx
          .update(orders)
          .set({ status: 'confirmed', updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      });
      await this.orders.notifyRestaurantPaidOrder(orderId);
    }
  }

  /** Local dev fallback when webhooks cannot reach localhost. */
  async devConfirmLemonReturn(orderId: string, userId: string): Promise<{ status: 'confirmed' | 'already_confirmed' }> {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');

    const [p] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.provider, 'lemon_squeeze')))
      .limit(1);
    if (!p) throw new NotFoundException('No Lemon Squeezy payment found for this order');

    if (order.status === 'confirmed') {
      return { status: 'already_confirmed' };
    }

    await this.confirmPayment(orderId, 'completed');
    return { status: 'confirmed' };
  }
}
