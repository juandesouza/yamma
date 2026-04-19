/**
 * Yamma – PostgreSQL schema via Drizzle ORM.
 * Single source of truth for `public` tables (Nhost = managed Postgres). Apply with `pnpm run db:migrate`
 * (or `db:push` on an empty DB); committed SQL is `backend/drizzle/*.sql`.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ─────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['customer', 'restaurant', 'admin', 'driver']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
]);
export const paymentProviderEnum = pgEnum('payment_provider', [
  'lemon_squeeze',
  'app_balance',
  'transak',
  'moonpay',
  'ramp',
]);

// ─── Users & Auth (Lucia-compatible) ─────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: roleEnum('role').notNull().default('customer'),
  /** 0 = all fiat, 100 = all crypto, 1–99 = split (for restaurant role). Ignored for customers. */
  cryptoPayoutPercent: integer('crypto_payout_percent').notNull().default(0),
  /** In-app crypto balance (order currency units) for paying with app_balance. */
  cryptoBalance: decimal('crypto_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  /** Tracked fiat-denominated balance for restaurant earnings (card/settlement fiat share). */
  fiatBalance: decimal('fiat_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Restaurants ────────────────────────────────────────────────────────────
export const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    imageUrl: text('image_url'),
    cuisine: text('cuisine'),
    address: text('address').notNull(),
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    isOpen: boolean('is_open').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('restaurants_owner_idx').on(t.ownerId), index('restaurants_slug_idx').on(t.slug)]
);

export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    menuId: uuid('menu_id')
      .notNull()
      .references(() => menus.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').default(0),
    available: boolean('available').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('menu_items_menu_idx').on(t.menuId)]
);

// ─── Orders ─────────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default('pending'),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryLatitude: decimal('delivery_latitude', { precision: 10, scale: 7 }),
    deliveryLongitude: decimal('delivery_longitude', { precision: 10, scale: 7 }),
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
    deliveryFee: decimal('delivery_fee', { precision: 10, scale: 2 }).default('0'),
    total: decimal('total', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('USD'),
    notes: text('notes'),
    /** Set when seller requests courier via partner API; order stays `confirmed` until driver accepts. */
    courierRequestedAt: timestamp('courier_requested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('orders_user_idx').on(t.userId),
    index('orders_restaurant_idx').on(t.restaurantId),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)]
);

// ─── On-ramp (fiat → crypto credits / order pay) ───────────────────────────
export const onrampIntents = pgTable(
  'onramp_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    intentKind: text('intent_kind').notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    fiatAmount: decimal('fiat_amount', { precision: 12, scale: 2 }).notNull(),
    fiatCurrency: text('fiat_currency').notNull().default('USD'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('onramp_intents_user_idx').on(t.userId),
    index('onramp_intents_order_idx').on(t.orderId),
    index('onramp_intents_status_idx').on(t.status),
  ]
);

// ─── Payments ───────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerPaymentId: text('provider_payment_id'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    metadata: text('metadata'), // JSON
    /** Short id for Lemon `redirect_url` (255 char max); full Expo deep link stored in `metadata.mobileResumeUrl`. */
    returnToken: text('return_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payments_order_idx').on(t.orderId),
    index('payments_provider_id_idx').on(t.providerPaymentId),
    uniqueIndex('payments_return_token_uidx').on(t.returnToken),
  ]
);

// ─── Reviews ───────────────────────────────────────────────────────────────
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('reviews_restaurant_idx').on(t.restaurantId),
    index('reviews_order_idx').on(t.orderId),
  ]
);

// ─── Drivers ───────────────────────────────────────────────────────────────────
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id').unique(), // ID from external driver app
    name: text('name').notNull(),
    phone: text('phone'),
    status: text('status').notNull().default('available'), // available | busy | offline
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('drivers_external_id_idx').on(t.externalId),
    index('drivers_status_idx').on(t.status),
  ]
);

// ─── Driver assignments (delivery integration) ────────────────────────────────
export const driverAssignments = pgTable(
  'driver_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('assigned'),
    currentLatitude: decimal('current_latitude', { precision: 10, scale: 7 }),
    currentLongitude: decimal('current_longitude', { precision: 10, scale: 7 }),
    estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('driver_assignments_order_idx').on(t.orderId),
    index('driver_assignments_driver_idx').on(t.driverId),
  ]
);

// ─── Relations ──────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  reviews: many(reviews),
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  owner: one(users),
  menus: many(menus),
  orders: many(orders),
  reviews: many(reviews),
}));

export const menusRelations = relations(menus, ({ one, many }) => ({
  restaurant: one(restaurants),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  menu: one(menus),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users),
  restaurant: one(restaurants),
  items: many(orderItems),
  payments: many(payments),
  reviews: many(reviews),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders),
  menuItem: one(menuItems),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  order: one(orders),
  user: one(users),
  restaurant: one(restaurants),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  assignments: many(driverAssignments),
}));

export const driverAssignmentsRelations = relations(driverAssignments, ({ one }) => ({
  order: one(orders),
  driver: one(drivers),
}));
