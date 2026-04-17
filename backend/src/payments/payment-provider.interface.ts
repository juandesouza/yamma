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
