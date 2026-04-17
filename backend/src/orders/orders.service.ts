import { Injectable } from '@nestjs/common';
import { createDb } from '../db';
import { orders, orderItems, menuItems, restaurants } from '../db/schema';
import { and, desc, eq, ne } from 'drizzle-orm';
import { ConfigService } from '../config/config.service';
import { EventsGateway } from '../events/events.gateway';

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const;

export interface CreateOrderInput {
  userId: string;
  restaurantId: string;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  items: { menuItemId: string; quantity: number; name: string; unitPrice: string }[];
  notes?: string;
}

@Injectable()
export class OrdersService {
  private db = createDb(process.env.DATABASE_URL!);
  constructor(
    private readonly config: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  async create(input: CreateOrderInput) {
    const subtotal = input.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0
    );
    const deliveryFee = subtotal < 30 ? 5 : 0;
    const total = subtotal + deliveryFee;
    const [order] = await this.db
      .insert(orders)
      .values({
        userId: input.userId,
        restaurantId: input.restaurantId,
        status: 'pending',
        deliveryAddress: input.deliveryAddress,
        deliveryLatitude: input.deliveryLatitude?.toString(),
        deliveryLongitude: input.deliveryLongitude?.toString(),
        subtotal: subtotal.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
        currency: 'USD',
        notes: input.notes,
      })
      .returning();
    if (!order) throw new Error('Order insert failed');
    for (const item of input.items) {
      await this.db.insert(orderItems).values({
        orderId: order.id,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }
    return order;
  }

  /**
   * Call after payment succeeds so the restaurant is not notified for unpaid checkout drafts.
   */
  async notifyRestaurantPaidOrder(orderId: string) {
    const order = await this.findById(orderId);
    if (!order || order.status === 'pending') return;
    this.events.emitRestaurantOrder(order.restaurantId, {
      id: order.id,
      restaurantId: order.restaurantId,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      deliveryAddress: order.deliveryAddress,
    });
  }

  async findById(id: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return o ?? null;
  }

  async findItems(orderId: string) {
    return this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async findByUser(userId: string, limit = 20) {
    return this.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async findByRestaurantOwner(ownerId: string, limit = 40) {
    return this.db
      .select({ order: orders, restaurant: restaurants })
      .from(orders)
      .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .where(and(eq(restaurants.ownerId, ownerId), ne(orders.status, 'pending')))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  /**
   * Seller hands off to external delivery app. Order stays `confirmed` until the partner
   * calls the driver-accepted webhook (then `in_transit`).
   */
  async requestCourierHandoff(orderId: string, ownerId: string) {
    const [row] = await this.db
      .select({ order: orders, restaurant: restaurants })
      .from(orders)
      .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .where(and(eq(orders.id, orderId), eq(restaurants.ownerId, ownerId)))
      .limit(1);
    if (!row) return { error: 'not_found' as const };

    const o = row.order;
    if (o.status !== 'confirmed') {
      return { error: 'invalid_status' as const, message: 'Order must be paid (confirmed) before dispatch.' };
    }
    if (o.courierRequestedAt) {
      return { error: 'already_dispatched' as const, message: 'Delivery partner was already notified.' };
    }

    const now = new Date();
    const [updated] = await this.db
      .update(orders)
      .set({ courierRequestedAt: now, updatedAt: now })
      .where(eq(orders.id, orderId))
      .returning();
    if (!updated) return { error: 'not_found' as const };

    const dispatchPayload = {
      orderId: updated.id,
      restaurantId: row.restaurant.id,
      pickup: {
        address: row.restaurant.address,
        latitude: Number(row.restaurant.latitude),
        longitude: Number(row.restaurant.longitude),
      },
      dropoff: {
        address: updated.deliveryAddress,
        latitude: updated.deliveryLatitude ? Number(updated.deliveryLatitude) : null,
        longitude: updated.deliveryLongitude ? Number(updated.deliveryLongitude) : null,
      },
      total: updated.total,
      currency: updated.currency ?? 'USD',
      createdAt: updated.createdAt,
    };

    this.events.emitOrderCourierHandoff(orderId);

    const dispatchUrl = this.config.deliveryDispatchUrl?.trim() || '';
    if (dispatchUrl) {
      try {
        await fetch(dispatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.deliveryDispatchToken
              ? { Authorization: `Bearer ${this.config.deliveryDispatchToken}` }
              : {}),
          },
          body: JSON.stringify(dispatchPayload),
        });
      } catch {
        // Partner app may be offline during local development.
      }
    }

    return { order: updated, dispatchPayload };
  }

  /**
   * Called by the external delivery app when a driver accepts the run.
   */
  async markInTransitFromPartner(orderId: string) {
    const order = await this.findById(orderId);
    if (!order) return { error: 'not_found' as const };
    if (order.status === 'in_transit') {
      return { order, alreadyInTransit: true as const };
    }
    if (order.status !== 'confirmed') {
      return { error: 'invalid_status' as const, message: 'Order is not awaiting a driver.' };
    }
    if (!order.courierRequestedAt) {
      return { error: 'no_handoff' as const, message: 'Restaurant has not sent this order to delivery yet.' };
    }

    const [inTransit] = await this.db
      .update(orders)
      .set({ status: 'in_transit', updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    if (!inTransit) return { error: 'not_found' as const };

    this.events.emitOrderStatus(orderId, 'in_transit');
    return { order: inTransit };
  }

  async updateStatus(orderId: string, status: (typeof ORDER_STATUSES)[number]) {
    const [o] = await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return o ?? null;
  }
}
