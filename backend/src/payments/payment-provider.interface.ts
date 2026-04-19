export type PaymentProviderType =
  | 'lemon_squeeze'
  | 'app_balance'
  | 'transak'
  | 'moonpay'
  | 'ramp';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
  /**
   * `web` — redirect to Next.js checkout return (browser session).
   * `mobile` — redirect to HTTPS bridge page that opens `yamma://` so the in-app browser can complete.
   */
  checkoutSuccessTarget?: 'web' | 'mobile';
  /**
   * Normalized origin only (e.g. `https://your-next.ngrok-free.app`), no trailing slash.
   * Used as Lemon `redirect_url` host; must be reachable from the buyer’s phone browser.
   */
  lemonRedirectBase: string;
  /** From order row — passed to Lemon checkout `custom_data` / webhooks. */
  restaurantId?: string;
  /**
   * Pre-generated opaque token; Lemon `redirect_url` is `${base}/payment/return/${returnToken}` (under 255 chars).
   * The real `exp://` / `yamma://` URL is stored in DB and resolved at redirect time.
   */
  returnToken?: string;
  /** Full deep link from `Linking.createURL` — stored server-side, not embedded in Lemon URL. */
  mobileAppResumeUrl?: string;
}

export interface PaymentResult {
  providerPaymentId: string;
  status: 'pending' | 'processing' | 'completed';
  checkoutUrl?: string;
  redirectUrl?: string;
  /** URL registered with the provider as post-checkout redirect (for `openAuthSessionAsync`). */
  successRedirectUrl?: string;
  /** True when payment finished in-process (app balance). */
  completedInApp?: boolean;
}

export interface IPaymentProvider {
  readonly name: PaymentProviderType;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  verifyWebhook(payload: string | Buffer, signature: string): boolean;
  handleWebhook(payload: unknown): Promise<{ orderId: string; status: 'completed' | 'failed' } | null>;
}
