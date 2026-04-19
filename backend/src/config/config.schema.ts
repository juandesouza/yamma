import { z } from 'zod';

export const configValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  LEMON_SQUEEZE_API_KEY: z.string().optional(),
  LEMON_SQUEEZE_WEBHOOK_SECRET: z.string().optional(),
  /** Lemon Squeezy dashboard → Settings (store id) and Products → variant id — required for card checkout */
  LEMON_SQUEEZE_STORE_ID: z.string().optional(),
  LEMON_SQUEEZE_VARIANT_ID: z.string().optional(),
  /** "true" / "false" — checkout test_mode; omit = true in development, false in production */
  LEMON_SQUEEZE_TEST_MODE: z.string().optional(),
  DELIVERY_WEBHOOK_SECRET: z.string().optional(),
  DELIVERY_DISPATCH_URL: z.string().url().optional(),
  DELIVERY_DISPATCH_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Allowed `aud` values for native / Expo Google ID tokens (often Android / iOS OAuth client IDs). */
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  GOOGLE_EXPO_CLIENT_ID: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  /** Comma-separated origins allowed for mobile Lemon return (e.g. `https://a.ngrok-free.app,https://b.ngrok.app`). */
  PAYMENT_RETURN_ORIGIN_ALLOWLIST: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /** Transak Partner API key (widget) */
  TRANSAK_API_KEY: z.string().optional(),
  /** Transak Partner access token (Create Widget URL API + webhook JWT verify) */
  TRANSAK_ACCESS_TOKEN: z.string().optional(),
  /** Domain registered in Transak dashboard (e.g. localhost or app.example.com) */
  TRANSAK_REFERRER_DOMAIN: z.string().optional(),
  /** true = api-gateway-stg.transak.com */
  TRANSAK_STAGING: z.string().optional(),
  /** EVM address receiving USDC from on-ramp (Yamma treasury); credits user/order in DB */
  ONRAMP_SETTLEMENT_WALLET: z.string().optional(),
  /** e.g. polygon, ethereum — must match Transak network codes */
  TRANSAK_USDC_NETWORK: z.string().optional(),
  MOONPAY_API_KEY: z.string().optional(),
  /** MoonPay currency code e.g. usdc_polygon */
  MOONPAY_USDC_CURRENCY_CODE: z.string().optional(),
  RAMP_API_KEY: z.string().optional(),
  /** e.g. USDC_POLYGON */
  RAMP_USDC_SWAP_ASSET: z.string().optional(),
  MOONPAY_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof configValidationSchema>;
