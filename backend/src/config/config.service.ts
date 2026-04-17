import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type { Env } from './config.schema';

@Injectable()
export class ConfigService {
  constructor(private nest: NestConfigService<Env>) {}

  get env(): Env['NODE_ENV'] {
    return this.nest.get('NODE_ENV', { infer: true })!;
  }

  get port(): number {
    return this.nest.get('PORT', { infer: true })!;
  }

  get apiUrl(): string {
    return this.nest.get('API_URL', { infer: true }) ?? `http://localhost:${this.port}`;
  }

  get databaseUrl(): string {
    return this.nest.get('DATABASE_URL', { infer: true })!;
  }

  get sessionSecret(): string {
    return this.nest.get('SESSION_SECRET', { infer: true })!;
  }

  get mapboxToken(): string | undefined {
    return this.nest.get('MAPBOX_ACCESS_TOKEN', { infer: true });
  }

  get lemonSqueezeApiKey(): string | undefined {
    return this.nest.get('LEMON_SQUEEZE_API_KEY', { infer: true });
  }

  get lemonSqueezeWebhookSecret(): string | undefined {
    return this.nest.get('LEMON_SQUEEZE_WEBHOOK_SECRET', { infer: true });
  }

  get lemonSqueezeStoreId(): string | undefined {
    return this.nest.get('LEMON_SQUEEZE_STORE_ID', { infer: true });
  }

  get lemonSqueezeVariantId(): string | undefined {
    return this.nest.get('LEMON_SQUEEZE_VARIANT_ID', { infer: true });
  }

  /**
   * Lemon Squeezy checkouts for test-mode products need `test_mode: true`.
   * Explicit LEMON_SQUEEZE_TEST_MODE wins; otherwise dev defaults to true, prod to false.
   */
  get lemonSqueezeCheckoutTestMode(): boolean {
    const raw = this.nest.get('LEMON_SQUEEZE_TEST_MODE', { infer: true })?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    return this.env === 'development';
  }

  get deliveryWebhookSecret(): string | undefined {
    return this.nest.get('DELIVERY_WEBHOOK_SECRET', { infer: true });
  }

  get deliveryDispatchUrl(): string | undefined {
    return this.nest.get('DELIVERY_DISPATCH_URL', { infer: true });
  }

  get deliveryDispatchToken(): string | undefined {
    return this.nest.get('DELIVERY_DISPATCH_TOKEN', { infer: true });
  }

  get googleClientId(): string | undefined {
    return this.nest.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get googleClientSecret(): string | undefined {
    return this.nest.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  /** Client IDs allowed as `aud` on Google ID tokens (web + native + Expo). */
  get googleOAuthAudiences(): string[] {
    const raw = [
      this.nest.get('GOOGLE_CLIENT_ID', { infer: true }),
      this.nest.get('GOOGLE_ANDROID_CLIENT_ID', { infer: true }),
      this.nest.get('GOOGLE_IOS_CLIENT_ID', { infer: true }),
      this.nest.get('GOOGLE_EXPO_CLIENT_ID', { infer: true }),
    ];
    return [...new Set(raw.map((s) => s?.trim()).filter((s): s is string => Boolean(s)))];
  }

  /** Must match the redirect URI registered in Google Cloud (Next.js route on the frontend). */
  get googleCallbackUrl(): string {
    return (
      this.nest.get('GOOGLE_CALLBACK_URL', { infer: true }) ?? `${this.frontendUrl}/api/auth/google/callback`
    );
  }

  get frontendUrl(): string {
    return this.nest.get('FRONTEND_URL', { infer: true }) ?? 'http://localhost:3000';
  }

  get smtpHost(): string | undefined {
    return this.nest.get('SMTP_HOST', { infer: true })?.trim();
  }

  get smtpPort(): number {
    return this.nest.get('SMTP_PORT', { infer: true }) ?? 587;
  }

  get smtpUser(): string | undefined {
    return this.nest.get('SMTP_USER', { infer: true })?.trim();
  }

  get smtpPass(): string | undefined {
    return this.nest.get('SMTP_PASS', { infer: true });
  }

  get smtpFrom(): string {
    return this.nest.get('SMTP_FROM', { infer: true })?.trim() || 'Yamma Support <no-reply@yamma.app>';
  }

  get transakApiKey(): string | undefined {
    return this.nest.get('TRANSAK_API_KEY', { infer: true });
  }

  get transakAccessToken(): string | undefined {
    return this.nest.get('TRANSAK_ACCESS_TOKEN', { infer: true });
  }

  get transakReferrerDomain(): string | undefined {
    return this.nest.get('TRANSAK_REFERRER_DOMAIN', { infer: true });
  }

  get transakStaging(): boolean {
    const v = this.nest.get('TRANSAK_STAGING', { infer: true })?.trim().toLowerCase();
    if (v === 'false' || v === '0') return false;
    if (v === 'true' || v === '1') return true;
    return this.env === 'development';
  }

  get onrampSettlementWallet(): string | undefined {
    return this.nest.get('ONRAMP_SETTLEMENT_WALLET', { infer: true });
  }

  get transakUsdcNetwork(): string {
    return this.nest.get('TRANSAK_USDC_NETWORK', { infer: true })?.trim() || 'polygon';
  }

  get moonpayApiKey(): string | undefined {
    return this.nest.get('MOONPAY_API_KEY', { infer: true });
  }

  get moonpayUsdcCurrencyCode(): string {
    return this.nest.get('MOONPAY_USDC_CURRENCY_CODE', { infer: true })?.trim() || 'usdc_polygon';
  }

  get rampApiKey(): string | undefined {
    return this.nest.get('RAMP_API_KEY', { infer: true });
  }

  get rampUsdcSwapAsset(): string {
    return this.nest.get('RAMP_USDC_SWAP_ASSET', { infer: true })?.trim() || 'USDC_POLYGON';
  }

  get moonpayWebhookSecret(): string | undefined {
    return this.nest.get('MOONPAY_WEBHOOK_SECRET', { infer: true });
  }
}
