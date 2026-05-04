import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createDb } from '../db';
import { payments, orders, users, restaurants } from '../db/schema';
import { and, eq, or, sql } from 'drizzle-orm';
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

  /** Resolves stored Expo / dev-client deep link for Lemon return URL `/payment/return/:token`. */
  async getMobileResumeUrlByReturnToken(token: string): Promise<string | null> {
    const t = token?.trim().toLowerCase();
    if (!t || !/^[a-f0-9]{32}$/.test(t)) return null;
    const [p] = await this.db
      .select({ metadata: payments.metadata })
      .from(payments)
      .where(
        or(
          eq(payments.returnToken, t),
          sql`(metadata::jsonb->>'lemonReturnToken') = ${t}`,
        ),
      )
      .limit(1);
    if (!p?.metadata) return null;
    try {
      const m = JSON.parse(p.metadata) as { mobileResumeUrl?: string };
      const url = m.mobileResumeUrl?.trim();
      if (!url) return null;
      const u = new URL(url);
      if (u.protocol !== 'exp:' && u.protocol !== 'yamma:') return null;
      return url;
    } catch {
      return null;
    }
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
    if (u.protocol !== 'exp:' && u.protocol !== 'yamma:') {
      throw new BadRequestException('mobileAppResumeUrl must use exp:// (Expo Go) or yamma:// (dev build).');
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

    const metadataPayload =
      mobileAppResumeUrl != null
        ? JSON.stringify({
            mobileResumeUrl: mobileAppResumeUrl,
            ...(returnToken ? { lemonReturnToken: returnToken } : {}),
          })
        : undefined;

    const paymentCols = await this.getPaymentColumnNames();
    const hasMethodColumn = paymentCols.has('method');
    const hasReturnTokenColumn = paymentCols.has('return_token');

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
      const metadataCols = metadataPayload ? sql`, "metadata"` : sql``;
      const metadataVals = metadataPayload ? sql`, ${metadataPayload}` : sql``;
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
          ${result.providerPaymentId},
          ${result.status},
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
        providerPaymentId: result.providerPaymentId,
        status: result.status,
        amount: amount.toFixed(2),
        currency,
        ...(returnToken ? { returnToken } : {}),
        ...(metadataPayload ? { metadata: metadataPayload } : {}),
      });
    }
    return result;
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
}
