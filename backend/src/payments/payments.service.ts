import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createDb } from '../db';
import { payments, orders, users, restaurants } from '../db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { LemonSqueezeProvider } from './providers/lemon-squeeze.provider';
import { OrdersService } from '../orders/orders.service';
import { ConfigService } from '../config/config.service';

export type CreatePaymentOptions = {
  checkoutSuccessTarget?: 'web' | 'mobile';
  /** Public origin of the web app (Next) for Lemon redirect — see controller schema. */
  paymentReturnBaseUrl?: string;
  /** Deep link from the mobile app (`Linking.createURL`) so the bridge can open Expo Go / dev client. */
  mobileAppResumeUrl?: string;
};

@Injectable()
export class PaymentsService {
  private db = createDb(process.env.DATABASE_URL!);
  private readonly logger = new Logger(PaymentsService.name);
  private paymentColumnNamesPromise: Promise<Set<string>> | null = null;
  private paymentMethodLabelsPromise: Promise<Set<string>> | null = null;

  constructor(
    private lemon: LemonSqueezeProvider,
    private orders: OrdersService,
    private config: ConfigService,
  ) {}

  getProvider() {
    return this.lemon;
  }

  /** Shared guard for dev-only payment shortcuts (optional `DEV_FORCE_CONFIRM_PAYMENT_TOKEN`). */
  private assertDevForceConfirmAllowed(presentedToken: string | undefined): void {
    if (this.config.env !== 'development') {
      throw new ForbiddenException('Force confirm is only available in development');
    }
    const expected = this.config.devForceConfirmPaymentToken;
    if (expected) {
      const got = presentedToken?.trim() ?? '';
      if (!got || got !== expected) {
        throw new UnauthorizedException('Invalid or missing X-Yamma-Dev-Force-Confirm-Token');
      }
    }
  }

  private async getPaymentColumnNames(): Promise<Set<string>> {
    if (!this.paymentColumnNamesPromise) {
      this.paymentColumnNamesPromise = this.db
        .execute(sql`
          select column_name
          from information_schema.columns
          where table_schema = 'public' and table_name = 'payments'
        `)
        .then((res) => {
          const out = new Set<string>();
          for (const row of res.rows as Array<{ column_name?: unknown }>) {
            if (typeof row.column_name === 'string') out.add(row.column_name);
          }
          return out;
        })
        .catch(() => new Set<string>());
    }
    return this.paymentColumnNamesPromise;
  }

  private async getPaymentMethodLabels(): Promise<Set<string>> {
    if (!this.paymentMethodLabelsPromise) {
      this.paymentMethodLabelsPromise = this.db
        .execute(sql`
          select e.enumlabel
          from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'payment_method'
        `)
        .then((res) => {
          const out = new Set<string>();
          for (const row of res.rows as Array<{ enumlabel?: unknown }>) {
            if (typeof row.enumlabel === 'string') out.add(row.enumlabel);
          }
          return out;
        })
        .catch(() => new Set<string>());
    }
    return this.paymentMethodLabelsPromise;
  }

  private pickLegacyPaymentMethod(labels: Set<string>): string | null {
    if (!labels.size) return null;
    // Prefer explicit "card" semantics first; otherwise use a provider-ish label.
    const preferred = ['card', 'credit_card', 'lemon_squeeze', 'online', 'checkout'];
    for (const p of preferred) {
      if (labels.has(p)) return p;
    }
    return Array.from(labels)[0] ?? null;
  }

  private isAllowedMobileResumeProtocol(protocol: string): boolean {
    return protocol === 'exp:' || protocol === 'yamma:' || protocol === 'expo:';
  }

  private buildMobileResumeFallback(orderId: string, restaurantId?: string): string {
    const q = restaurantId?.trim()
      ? `orderId=${encodeURIComponent(orderId)}&restaurantId=${encodeURIComponent(restaurantId.trim())}`
      : `orderId=${encodeURIComponent(orderId)}`;
    return `yamma://payment-return?${q}`;
  }

  private parseStoredMobileResumeUrl(
    metadataRaw: string | null | undefined,
    orderId: string | null | undefined,
    restaurantId?: string,
  ): string | null {
    if (metadataRaw?.trim()) {
      try {
        const m = JSON.parse(metadataRaw) as {
          mobileResumeUrl?: string;
          orderId?: string;
          restaurantId?: string;
        };
        const url = m.mobileResumeUrl?.trim();
        if (url) {
          try {
            const u = new URL(url);
            if (this.isAllowedMobileResumeProtocol(u.protocol)) return url;
          } catch {
            if (/^(exp|yamma|expo):\/\//i.test(url)) return url;
          }
        }
        const oid = m.orderId?.trim() || orderId?.trim();
        if (oid) return this.buildMobileResumeFallback(oid, m.restaurantId ?? restaurantId);
      } catch {
        /* fall through */
      }
    }
    const oid = orderId?.trim();
    return oid ? this.buildMobileResumeFallback(oid, restaurantId) : null;
  }

  /** Resolves stored Expo / dev-client deep link for Lemon return URL `/payment/return/:token`. */
  async getMobileResumeUrlByReturnToken(token: string): Promise<string | null> {
    const t = token?.trim().toLowerCase();
    if (!t || !/^[a-f0-9]{32}$/.test(t)) return null;

    const paymentCols = await this.getPaymentColumnNames();
    const hasReturnTokenColumn = paymentCols.has('return_token');
    const hasMetadataColumn = paymentCols.has('metadata');

    let row: { metadata: string | null; order_id: string | null; restaurant_id: string | null } | undefined;

    if (hasReturnTokenColumn) {
      const res = await this.db.execute(sql`
        select
          ${hasMetadataColumn ? sql`p.metadata` : sql`null::text as metadata`},
          p.order_id::text as order_id,
          o.restaurant_id::text as restaurant_id
        from payments p
        inner join orders o on o.id = p.order_id
        where lower(p.return_token) = ${t}
           or (
             ${hasMetadataColumn ? sql`p.metadata is not null and (p.metadata::jsonb->>'lemonReturnToken') = ${t}` : sql`false`}
           )
        order by p.created_at desc
        limit 1
      `);
      row = res.rows[0] as typeof row;
    } else if (hasMetadataColumn) {
      const res = await this.db.execute(sql`
        select
          p.metadata,
          p.order_id::text as order_id,
          o.restaurant_id::text as restaurant_id
        from payments p
        inner join orders o on o.id = p.order_id
        where p.metadata is not null and (p.metadata::jsonb->>'lemonReturnToken') = ${t}
        order by p.created_at desc
        limit 1
      `);
      row = res.rows[0] as typeof row;
    }

    if (!row) {
      this.logger.warn(`payment return token not found token=${t.slice(0, 8)}…`);
      return null;
    }

    const target = this.parseStoredMobileResumeUrl(
      row.metadata,
      row.order_id,
      row.restaurant_id ?? undefined,
    );
    if (!target) {
      this.logger.warn(
        `payment return token ${t.slice(0, 8)}… matched payment but no resume URL (orderId=${row.order_id ?? 'unknown'})`,
      );
    }
    return target;
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

  private resolveLemonRedirectBase(
    checkoutSuccessTarget: 'web' | 'mobile' | undefined,
    paymentReturnBaseUrl: string | undefined,
  ): string {
    const fe = this.config.frontendUrl.replace(/\/$/, '');
    if (checkoutSuccessTarget !== 'mobile') {
      if (this.config.env === 'production') {
        try {
          const u = new URL(fe);
          if (
            u.protocol !== 'https:' ||
            ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
          ) {
            throw new BadRequestException(
              'Card checkout return URL is invalid for production. Set FRONTEND_URL to your public web app origin (e.g. https://yamma-web.vercel.app), not localhost.',
            );
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          throw new BadRequestException(
            'Card checkout return URL is invalid for production. Set FRONTEND_URL to your public web app origin (e.g. https://yamma-web.vercel.app).',
          );
        }
      }
      return fe;
    }

    if (!paymentReturnBaseUrl?.trim()) {
      try {
        const api = new URL(this.config.apiUrl);
        if (
          api.protocol === 'https:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)
        ) {
          return api.origin.replace(/\/$/, '');
        }
      } catch {
        /* fall through */
      }
      try {
        const h = new URL(this.config.frontendUrl).hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') {
          throw new BadRequestException(
            'Mobile card checkout needs a public HTTPS URL for the return page. Set EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL on the mobile app, or use an HTTPS EXPO_PUBLIC_API_URL (e.g. ngrok to port 3001) so the API can serve /payment/app-redirect. FRONTEND_URL is localhost, which the phone cannot open after Lemon Squeezy.',
          );
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
      return fe;
    }

    let raw = paymentReturnBaseUrl.trim().replace(/\/$/, '');
    if (!/^[a-z]+:\/\//i.test(raw)) {
      raw = `https://${raw}`;
    }
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new BadRequestException(
        'Invalid paymentReturnBaseUrl. Use a full URL or host your phone can reach (e.g. https://your-next.ngrok-free.app).',
      );
    }

    const origin = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;

    if (u.protocol === 'http:') {
      const okHost = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
      if (!okHost) {
        throw new BadRequestException('paymentReturnBaseUrl: http is only allowed for localhost');
      }
    } else if (u.protocol !== 'https:') {
      throw new BadRequestException('paymentReturnBaseUrl must use http:// or https://');
    }

    if (this.config.env === 'production') {
      let feOrigin: string;
      try {
        feOrigin = new URL(this.config.frontendUrl).origin;
      } catch {
        feOrigin = '';
      }
      let apiOrigin: string;
      try {
        apiOrigin = new URL(this.config.apiUrl).origin;
      } catch {
        apiOrigin = '';
      }
      const allowed = new Set([
        feOrigin,
        apiOrigin,
        ...this.config.paymentReturnOriginAllowlistOrigins,
      ]);
      if (!allowed.has(origin)) {
        throw new ForbiddenException(
          'paymentReturnBaseUrl origin is not allowed. It must match FRONTEND_URL, API_URL, or PAYMENT_RETURN_ORIGIN_ALLOWLIST.',
        );
      }
    }

    return origin.replace(/\/$/, '');
  }

  private normalizeMobileAppResumeUrl(
    raw: string | undefined,
    checkoutSuccessTarget: 'web' | 'mobile' | undefined,
  ): string | undefined {
    if (checkoutSuccessTarget !== 'mobile' || !raw?.trim()) return undefined;
    const t = raw.trim();
    if (t.length > 4096) {
      throw new BadRequestException('mobileAppResumeUrl is too long.');
    }
    let u: URL;
    try {
      u = new URL(t);
    } catch {
      throw new BadRequestException('mobileAppResumeUrl must be a valid URL (from expo-linking).');
    }
    if (u.protocol !== 'exp:' && u.protocol !== 'yamma:' && u.protocol !== 'expo:') {
      throw new BadRequestException('mobileAppResumeUrl must use exp:// (Expo Go), expo://, or yamma:// (dev build).');
    }
    return t;
  }

  async createPayment(orderId: string, provider: string, userId: string, options?: CreatePaymentOptions) {
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

    const lemonRedirectBase = this.resolveLemonRedirectBase(
      options?.checkoutSuccessTarget,
      options?.paymentReturnBaseUrl,
    );

    const mobileAppResumeUrl = this.normalizeMobileAppResumeUrl(
      options?.mobileAppResumeUrl,
      options?.checkoutSuccessTarget,
    );
    if (options?.checkoutSuccessTarget === 'mobile' && !mobileAppResumeUrl) {
      throw new BadRequestException(
        'mobileAppResumeUrl is required for mobile checkout (Expo Linking.createURL for payment-return).',
      );
    }

    const returnToken =
      options?.checkoutSuccessTarget === 'mobile' ? randomBytes(16).toString('hex').toLowerCase() : undefined;

    const metadataPayload =
      mobileAppResumeUrl != null
        ? JSON.stringify({
            mobileResumeUrl: mobileAppResumeUrl,
            orderId,
            restaurantId: order.restaurantId,
            ...(returnToken ? { lemonReturnToken: returnToken } : {}),
          })
        : undefined;

    const paymentCols = await this.getPaymentColumnNames();
    const hasMethodColumn = paymentCols.has('method');
    const hasReturnTokenColumn = paymentCols.has('return_token');
    const hasMetadataColumn = paymentCols.has('metadata');

    await this.insertPendingLemonPayment({
      orderId,
      amount,
      currency,
      returnToken,
      metadataPayload,
      paymentCols,
      hasMethodColumn,
      hasReturnTokenColumn,
      hasMetadataColumn,
    });

    let result: Awaited<ReturnType<LemonSqueezeProvider['createPayment']>>;
    try {
      result = await this.lemon.createPayment({
        orderId,
        amount,
        currency,
        checkoutSuccessTarget: options?.checkoutSuccessTarget,
        lemonRedirectBase,
        restaurantId: order.restaurantId,
        returnToken,
        mobileAppResumeUrl,
      });
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Payment provider error';
      if (msg.length > 600) msg = `${msg.slice(0, 597)}…`;
      this.logger.warn(`Lemon createPayment failed orderId=${orderId}: ${msg}`);
      if (/not configured/i.test(msg)) {
        throw new ServiceUnavailableException(msg);
      }
      /** 400 — Lemon misconfig / API rejection; avoid 502 which looks like an infra outage. */
      throw new BadRequestException(msg);
    }

    if (returnToken && hasReturnTokenColumn) {
      await this.db
        .update(payments)
        .set({
          providerPaymentId: result.providerPaymentId,
          updatedAt: new Date(),
        })
        .where(eq(payments.returnToken, returnToken));
    } else if (returnToken && hasMetadataColumn) {
      await this.db.execute(sql`
        update payments
        set provider_payment_id = ${result.providerPaymentId}, updated_at = now()
        where metadata is not null and (metadata::jsonb->>'lemonReturnToken') = ${returnToken}
      `);
    } else {
      await this.db
        .update(payments)
        .set({
          providerPaymentId: result.providerPaymentId,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.orderId, orderId), eq(payments.provider, 'lemon_squeeze')));
    }

    return result;
  }

  private async insertPendingLemonPayment(args: {
    orderId: string;
    amount: number;
    currency: string;
    returnToken?: string;
    metadataPayload?: string;
    paymentCols: Set<string>;
    hasMethodColumn: boolean;
    hasReturnTokenColumn: boolean;
    hasMetadataColumn: boolean;
  }) {
    const {
      orderId,
      amount,
      currency,
      returnToken,
      metadataPayload,
      hasMethodColumn,
      hasReturnTokenColumn,
      hasMetadataColumn,
    } = args;

    if (hasMethodColumn || !hasReturnTokenColumn) {
      let methodValue: string | null = null;
      if (hasMethodColumn) {
        const labels = await this.getPaymentMethodLabels();
        methodValue = this.pickLegacyPaymentMethod(labels);
        if (!methodValue) {
          throw new BadRequestException(
            'Legacy payments.method enum has no values available; run DB migration/alignment.',
          );
        }
      }
      const methodCols = hasMethodColumn ? sql`, "method"` : sql``;
      const methodVals = hasMethodColumn ? sql`, ${methodValue}` : sql``;
      const returnTokenCols = hasReturnTokenColumn && returnToken ? sql`, "return_token"` : sql``;
      const returnTokenVals = hasReturnTokenColumn && returnToken ? sql`, ${returnToken}` : sql``;
      const metadataCols =
        hasMetadataColumn && metadataPayload ? sql`, "metadata"` : sql``;
      const metadataVals =
        hasMetadataColumn && metadataPayload ? sql`, ${metadataPayload}` : sql``;
      await this.db.execute(sql`
        insert into "payments" (
          "order_id",
          "provider",
          "provider_payment_id",
          "status",
          "amount",
          "currency"
          ${methodCols}
          ${returnTokenCols}
          ${metadataCols}
        ) values (
          ${orderId}::uuid,
          ${'lemon_squeeze'},
          ${null},
          ${'pending'},
          ${amount.toFixed(2)}::numeric,
          ${currency}
          ${methodVals}
          ${returnTokenVals}
          ${metadataVals}
        )
      `);
    } else {
      await this.db.insert(payments).values({
        orderId,
        provider: 'lemon_squeeze',
        providerPaymentId: null,
        status: 'pending',
        amount: amount.toFixed(2),
        currency,
        ...(returnToken ? { returnToken } : {}),
        ...(metadataPayload ? { metadata: metadataPayload } : {}),
      });
    }
  }

  async confirmPayment(orderId: string, status: 'completed' | 'failed') {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.logger.log(`confirmPayment called orderId=${orderId} paymentStatus=${status} orderStatus=${order.status}`);

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
      this.logger.log(`order confirmed orderId=${orderId}`);
    } else {
      this.logger.log(`confirmPayment skipped orderId=${orderId} paymentStatus=${status} orderStatus=${order.status}`);
    }
  }

  /**
   * Confirms the order when Lemon shows the payment as paid but our webhook did not run
   * (localhost, misconfigured URL, etc.). Uses Lemon’s Orders API — not a blind confirm.
   */
  async syncLemonOrderAfterCheckout(
    orderId: string,
    userId: string,
  ): Promise<{ status: 'confirmed' | 'already_confirmed' | 'still_pending' }> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');

    const [p] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.provider, 'lemon_squeeze')))
      .limit(1);
    if (!p) throw new NotFoundException('No Lemon Squeezy payment found for this order');

    if (order.status !== 'pending') {
      return { status: 'already_confirmed' };
    }

    const storeId = this.config.lemonSqueezeStoreId?.trim();
    if (!storeId) {
      this.logger.warn('syncLemonOrderAfterCheckout: LEMON_SQUEEZE_STORE_ID missing');
      return { status: 'still_pending' };
    }

    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);

    const matched = await this.lemon.lookupPaidOrderForSync({
      storeId,
      yammaOrderId: orderId,
      checkoutId: p.providerPaymentId ?? null,
      yammaTotalUsd: order.total,
      userEmail: u?.email ?? null,
      paymentCreatedAt: p.createdAt,
      lemonTestMode: this.config.lemonSqueezeCheckoutTestMode,
    });

    if (!matched) {
      return { status: 'still_pending' };
    }

    await this.confirmPayment(orderId, 'completed');
    return { status: 'confirmed' };
  }

  /** @deprecated Use `syncLemonOrderAfterCheckout` — kept for older clients. */
  async devConfirmLemonReturn(orderId: string, userId: string) {
    return this.syncLemonOrderAfterCheckout(orderId, userId);
  }

  /**
   * Development only: mark the order paid/confirmed without calling Lemon (local testing when
   * webhooks/sync are unavailable). Same side effects as a successful `confirmPayment('completed')`.
   */
  async devForceConfirmCheckout(orderId: string, userId: string, presentedToken: string | undefined) {
    this.assertDevForceConfirmAllowed(presentedToken);

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const [restaurantRow] = await this.db
      .select({ ownerId: restaurants.ownerId })
      .from(restaurants)
      .where(eq(restaurants.id, order.restaurantId))
      .limit(1);
    const isBuyer = order.userId === userId;
    const isRestaurantOwner = restaurantRow?.ownerId === userId;
    if (!isBuyer && !isRestaurantOwner) {
      throw new ForbiddenException('Not your order');
    }

    if (order.status !== 'pending') {
      return { status: 'already_confirmed' as const };
    }

    await this.confirmPayment(orderId, 'completed');
    this.logger.warn(
      `devForceConfirmCheckout: order ${orderId} confirmed (${isBuyer ? 'buyer' : 'seller'}) without Lemon verification`,
    );
    return { status: 'confirmed' as const };
  }

  /**
   * Development only: confirm latest `pending` order — as buyer (`customer`) or at your restaurant (`seller`).
   */
  async devForceConfirmLatestPending(
    userId: string,
    presentedToken: string | undefined,
    scope: 'customer' | 'seller' = 'customer',
  ): Promise<
    | { status: 'confirmed'; orderId: string; scope: 'customer' | 'seller' }
    | { status: 'no_pending'; scope: 'customer' | 'seller' }
    | { status: 'already_confirmed'; orderId: string; scope: 'customer' | 'seller' }
  > {
    this.assertDevForceConfirmAllowed(presentedToken);

    let orderId: string | null = null;
    if (scope === 'customer') {
      const [row] = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.status, 'pending')))
        .orderBy(desc(orders.createdAt))
        .limit(1);
      orderId = row?.id ?? null;
    } else {
      const [row] = await this.db
        .select({ id: orders.id })
        .from(orders)
        .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
        .where(and(eq(restaurants.ownerId, userId), eq(orders.status, 'pending')))
        .orderBy(desc(orders.createdAt))
        .limit(1);
      orderId = row?.id ?? null;
    }

    if (!orderId) {
      return { status: 'no_pending', scope };
    }

    const order = await this.orders.findById(orderId);
    if (!order || order.status !== 'pending') {
      return { status: 'already_confirmed', orderId, scope };
    }

    await this.confirmPayment(orderId, 'completed');
    this.logger.warn(
      `devForceConfirmLatestPending: order ${orderId} confirmed (${scope}) without Lemon verification`,
    );
    return { status: 'confirmed', orderId, scope };
  }
}
