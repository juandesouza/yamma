import { Injectable } from '@nestjs/common';
import type { InferSelectModel, SQL } from 'drizzle-orm';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createDb } from '../db';
import { orders, orderItems, menuItems, restaurants } from '../db/schema';
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

function isPgNotNullViolationOnCustomerId(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code) : '';
  const msg = 'message' in err ? String((err as { message?: unknown }).message) : '';
  return code === '23502' && msg.includes('customer_id');
}

function isPgNotNullViolationOnOrderItemTotalPrice(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code) : '';
  const msg = 'message' in err ? String((err as { message?: unknown }).message) : '';
  return code === '23502' && msg.includes('total_price');
}

@Injectable()
export class OrdersService {
  private db = createDb(process.env.DATABASE_URL!);
  private orderColumnTypesPromise: Promise<Record<string, string>> | null = null;
  constructor(
    private readonly config: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  private invalidateOrderColumnCache() {
    this.orderColumnTypesPromise = null;
  }

  private async getOrderColumnTypes(): Promise<Record<string, string>> {
    if (!this.orderColumnTypesPromise) {
      this.orderColumnTypesPromise = this.db
        .execute(
          sql`
            select column_name, data_type
            from information_schema.columns
            where table_schema = 'public' and table_name = 'orders'
          `,
        )
        .then((res) => {
          const out: Record<string, string> = {};
          for (const row of res.rows as Array<{ column_name?: unknown; data_type?: unknown }>) {
            const key = typeof row.column_name === 'string' ? row.column_name : '';
            const type = typeof row.data_type === 'string' ? row.data_type : '';
            if (key) out[key] = type;
          }
          return out;
        })
        .catch(() => {
          this.orderColumnTypesPromise = null;
          return {};
        });
    }
    return this.orderColumnTypesPromise;
  }

  /** Columns present on `order_items` (legacy Nhost schemas differ). */
  private async getOrderItemColumnNames(): Promise<Set<string>> {
    try {
      const res = await this.db.execute(sql`
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = 'order_items'
      `);
      const s = new Set<string>();
      for (const row of res.rows as Array<{ column_name?: unknown }>) {
        if (typeof row.column_name === 'string') s.add(row.column_name);
      }
      return s;
    } catch {
      return new Set<string>();
    }
  }

  /** True if `orders.customer_id` exists (legacy Nhost / older schemas). */
  private async ordersTableHasCustomerIdColumn(): Promise<boolean> {
    const res = await this.db.execute(sql`
      select 1 as x
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'customer_id'
      limit 1
    `);
    return ((res as { rows?: unknown[] }).rows?.length ?? 0) > 0;
  }

  private asInsertValue(
    columnName: string,
    value: string | number | null | undefined,
    colTypes: Record<string, string>,
  ) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const t = (colTypes[columnName] ?? '').toLowerCase();
    if (t === 'json' || t === 'jsonb') {
      return JSON.stringify(value);
    }
    return value;
  }

  private sqlForOrderColumn(
    colTypes: Record<string, string>,
    column: string,
    value: string | number | undefined,
  ): SQL {
    if (value === undefined) return sql`NULL`;
    const t = (colTypes[column] ?? '').toLowerCase();
    if (t === 'json' || t === 'jsonb') {
      return sql`${JSON.stringify(String(value))}::jsonb`;
    }
    return sql`${String(value)}`;
  }

  private sqlNumericOptional(v: number | undefined): SQL {
    if (v === undefined || Number.isNaN(v)) return sql`NULL`;
    return sql`${String(v)}::numeric`;
  }

  private mapRawOrderRow(raw: Record<string, unknown>): InferSelectModel<typeof orders> {
    return {
      id: String(raw.id),
      userId: String(raw.user_id),
      restaurantId: String(raw.restaurant_id),
      status: String(raw.status) as InferSelectModel<typeof orders>['status'],
      deliveryAddress:
        typeof raw.delivery_address === 'string'
          ? raw.delivery_address
          : raw.delivery_address != null
            ? JSON.stringify(raw.delivery_address)
            : '',
      deliveryLatitude:
        raw.delivery_latitude != null ? String(raw.delivery_latitude) : null,
      deliveryLongitude:
        raw.delivery_longitude != null ? String(raw.delivery_longitude) : null,
      subtotal: String(raw.subtotal),
      deliveryFee: raw.delivery_fee != null ? String(raw.delivery_fee) : '0',
      total: String(raw.total),
      currency: raw.currency != null ? String(raw.currency) : 'USD',
      notes:
        raw.notes == null
          ? null
          : typeof raw.notes === 'string'
            ? raw.notes
            : JSON.stringify(raw.notes),
      courierRequestedAt: raw.courier_requested_at
        ? new Date(String(raw.courier_requested_at))
        : null,
      createdAt: new Date(String(raw.created_at)),
      updatedAt: new Date(String(raw.updated_at)),
    };
  }

  /**
   * Legacy DBs have NOT NULL `customer_id` while the Drizzle schema only knows `user_id`.
   */
  private async insertOrderWithLegacyCustomerId(
    input: CreateOrderInput,
    colTypes: Record<string, string>,
    subtotal: number,
    deliveryFee: number,
    total: number,
  ): Promise<InferSelectModel<typeof orders>> {
    const subtotalFixed = subtotal.toFixed(2);
    const deliveryFeeFixed = deliveryFee.toFixed(2);
    const totalFixed = total.toFixed(2);
    const addrSql = this.sqlForOrderColumn(colTypes, 'delivery_address', input.deliveryAddress);
    const notesFragment =
      input.notes === undefined
        ? { cols: sql``, vals: sql`` }
        : {
            cols: sql`, notes`,
            vals: sql`, ${this.sqlForOrderColumn(colTypes, 'notes', input.notes)}`,
          };

    const result = await this.db.execute(sql`
      insert into orders (
        user_id,
        customer_id,
        restaurant_id,
        status,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        subtotal,
        delivery_fee,
        total,
        currency
        ${notesFragment.cols}
      ) values (
        ${input.userId}::uuid,
        ${input.userId}::uuid,
        ${input.restaurantId}::uuid,
        'pending',
        ${addrSql},
        ${this.sqlNumericOptional(input.deliveryLatitude)},
        ${this.sqlNumericOptional(input.deliveryLongitude)},
        ${subtotalFixed}::numeric,
        ${deliveryFeeFixed}::numeric,
        ${totalFixed}::numeric,
        'USD'
        ${notesFragment.vals}
      )
      returning
        id,
        user_id,
        restaurant_id,
        status,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        subtotal,
        delivery_fee,
        total,
        currency,
        notes,
        courier_requested_at,
        created_at,
        updated_at
    `);

    const rows = (result as { rows?: Record<string, unknown>[] }).rows;
    const row = rows?.[0];
    if (!row) throw new Error('Order insert failed');
    return this.mapRawOrderRow(row);
  }

  async create(input: CreateOrderInput) {
    const subtotal = input.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0
    );
    const deliveryFee = subtotal < 30 ? 5 : 0;
    const total = subtotal + deliveryFee;
    let colTypes = await this.getOrderColumnTypes();
    const hasCustomerIdCol =
      Object.prototype.hasOwnProperty.call(colTypes, 'customer_id') ||
      (await this.ordersTableHasCustomerIdColumn().catch(() => false));

    let order: InferSelectModel<typeof orders> | undefined;

    if (hasCustomerIdCol) {
      order = await this.insertOrderWithLegacyCustomerId(input, colTypes, subtotal, deliveryFee, total);
    } else {
      try {
        order = (
          await this.db
            .insert(orders)
            .values({
              userId: input.userId,
              restaurantId: input.restaurantId,
              status: 'pending',
              deliveryAddress: this.asInsertValue('delivery_address', input.deliveryAddress, colTypes) as string,
              deliveryLatitude: input.deliveryLatitude?.toString(),
              deliveryLongitude: input.deliveryLongitude?.toString(),
              subtotal: subtotal.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              total: total.toFixed(2),
              currency: 'USD',
              notes: this.asInsertValue('notes', input.notes, colTypes) as string | undefined,
            })
            .returning({
              id: orders.id,
              userId: orders.userId,
              restaurantId: orders.restaurantId,
              status: orders.status,
              deliveryAddress: orders.deliveryAddress,
              deliveryLatitude: orders.deliveryLatitude,
              deliveryLongitude: orders.deliveryLongitude,
              subtotal: orders.subtotal,
              deliveryFee: orders.deliveryFee,
              total: orders.total,
              currency: orders.currency,
              notes: orders.notes,
              courierRequestedAt: orders.courierRequestedAt,
              createdAt: orders.createdAt,
              updatedAt: orders.updatedAt,
            })
        )[0];
      } catch (e) {
        if (!isPgNotNullViolationOnCustomerId(e)) throw e;
        this.invalidateOrderColumnCache();
        colTypes = await this.getOrderColumnTypes();
        order = await this.insertOrderWithLegacyCustomerId(input, colTypes, subtotal, deliveryFee, total);
      }
    }
    if (!order) throw new Error('Order insert failed');

    const orderItemCols = await this.getOrderItemColumnNames();

    for (const item of input.items) {
      const lineTotal = (Number(item.unitPrice) * item.quantity).toFixed(2);
      if (orderItemCols.has('total_price')) {
        await this.db.execute(sql`
          insert into "order_items" (
            "order_id",
            "menu_item_id",
            "name",
            "quantity",
            "unit_price",
            "total_price"
          ) values (
            ${order.id}::uuid,
            ${item.menuItemId}::uuid,
            ${item.name},
            ${item.quantity},
            ${item.unitPrice}::numeric,
            ${lineTotal}::numeric
          )
        `);
      } else {
        try {
          await this.db.insert(orderItems).values({
            orderId: order.id,
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          });
        } catch (e) {
          if (!isPgNotNullViolationOnOrderItemTotalPrice(e)) throw e;
          await this.db.execute(sql`
            insert into "order_items" (
              "order_id",
              "menu_item_id",
              "name",
              "quantity",
              "unit_price",
              "total_price"
            ) values (
              ${order.id}::uuid,
              ${item.menuItemId}::uuid,
              ${item.name},
              ${item.quantity},
              ${item.unitPrice}::numeric,
              ${lineTotal}::numeric
            )
          `);
        }
      }
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
      .where(eq(restaurants.ownerId, ownerId))
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
