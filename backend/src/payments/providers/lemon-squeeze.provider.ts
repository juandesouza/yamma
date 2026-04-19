import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import type { IPaymentProvider, CreatePaymentInput, PaymentResult } from '../payment-provider.interface';
import crypto from 'crypto';

const LEMON_API = 'https://api.lemonsqueezy.com/v1';

/** JSON:API errors from Lemon Squeezy can be huge; keep user-facing messages short. */
function summarizeLemonApiError(rawBody: string): string {
  const max = 280;
  try {
    const j = JSON.parse(rawBody) as {
      errors?: Array<{
        detail?: string;
        title?: string;
        source?: { pointer?: string };
      }>;
    };
    if (j.errors?.length) {
      const parts = j.errors
        .map((e) => {
          const base = [e.title, e.detail].filter(Boolean).join(': ');
          const ptr = e.source?.pointer;
          return ptr ? `${base} (${ptr})` : base;
        })
        .filter(Boolean)
        .slice(0, 4);
      const s = parts.join(' · ');
      if (s) return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
    }
  } catch {
    /* not JSON */
  }
  const t = rawBody.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function notFoundHint(summary: string): string {
  if (!/not exist|not found/i.test(summary)) return '';
  return (
    ' Confirm LEMON_SQUEEZE_VARIANT_ID (Products → variant → Copy ID) and LEMON_SQUEEZE_STORE_ID (Settings → Stores). ' +
    'Set LEMON_SQUEEZE_TEST_MODE=true for test products or false for live.'
  );
}

/** Lemon returns 404 on /data/relationships/variant when the id is wrong or test/live mode mismatches. */
function isVariantRelationship404(status: number, rawBody: string): boolean {
  if (status !== 404) return false;
  try {
    const j = JSON.parse(rawBody) as {
      errors?: Array<{ source?: { pointer?: string } }>;
    };
    return (
      j.errors?.some((e) => {
        const p = e.source?.pointer ?? '';
        return p === '/data/relationships/variant' || p.endsWith('relationships/variant');
      }) ?? false
    );
  } catch {
    return false;
  }
}

function stripOptionalQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

function normalizeLemonNumericId(s: string): string {
  return stripOptionalQuotes(s).replace(/^#/, '').trim();
}

@Injectable()
export class LemonSqueezeProvider implements IPaymentProvider {
  readonly name = 'lemon_squeeze' as const;
  private apiKey: string;
  private webhookSecret: string | undefined;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.lemonSqueezeApiKey ?? '';
    this.webhookSecret = this.config.lemonSqueezeWebhookSecret;
  }

  /** Confirms variant exists and product.store_id matches configured store (avoids vague checkout 404s). */
  private async assertVariantMatchesStore(variantId: string, storeId: string): Promise<void> {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };
    const vRes = await fetch(`${LEMON_API}/variants/${encodeURIComponent(variantId)}`, { headers });
    const vRaw = await vRes.text();
    if (vRes.status === 404) {
      throw new Error(
        `Lemon Squeezy: variant id "${variantId}" was not found for this API key. ` +
          `From repo root run: pnpm run lemon:list-variants -w backend — use the printed variant id as LEMON_SQUEEZE_VARIANT_ID.`,
      );
    }
    if (!vRes.ok) {
      throw new Error(`Lemon Squeezy: could not look up variant (${vRes.status})`);
    }
    let vJson: {
      data?: {
        relationships?: {
          product?: {
            data?: { id?: string };
            links?: { related?: string };
          };
        };
      };
    };
    try {
      vJson = JSON.parse(vRaw) as typeof vJson;
    } catch {
      return;
    }
    let productId = vJson.data?.relationships?.product?.data?.id;
    const related = vJson.data?.relationships?.product?.links?.related;
    if (!productId && related) {
      const pRes = await fetch(related, { headers });
      if (pRes.ok) {
        try {
          const pJson = (await pRes.json()) as { data?: { id?: string } };
          productId = pJson.data?.id;
        } catch {
          /* skip */
        }
      }
    }
    if (!productId) return;
    const pRes = await fetch(`${LEMON_API}/products/${encodeURIComponent(productId)}`, { headers });
    if (!pRes.ok) return;
    const pJson = (await pRes.json()) as { data?: { attributes?: { store_id?: number } } };
    const apiStore = pJson.data?.attributes?.store_id;
    if (apiStore != null && String(apiStore) !== String(storeId)) {
      throw new Error(
        `Lemon Squeezy: variant ${variantId} is on store_id ${apiStore}, but LEMON_SQUEEZE_STORE_ID is ${storeId}. ` +
          `Fix the store id (Settings → Stores) or pick a variant from that store (see pnpm run lemon:list-variants -w backend).`,
      );
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!this.apiKey) throw new Error('Lemon Squeeze API key not configured');

    const storeId = normalizeLemonNumericId(this.config.lemonSqueezeStoreId ?? '');
    const variantId = normalizeLemonNumericId(this.config.lemonSqueezeVariantId ?? '');
    if (!storeId || !variantId) {
      throw new Error(
        'Lemon Squeezy: set LEMON_SQUEEZE_STORE_ID and LEMON_SQUEEZE_VARIANT_ID in backend env (dashboard: Store ID + product variant ID).',
      );
    }

    const cents = Math.max(1, Math.round(input.amount * 100));
    const base = input.lemonRedirectBase.replace(/\/$/, '');
    // Lemon: `redirect_url` max 255 chars — use short `/payment/return/:token`; real `exp://` URL is stored in DB.
    const redirectUrl =
      input.checkoutSuccessTarget === 'mobile'
        ? (() => {
            const tok = input.returnToken?.trim();
            if (!tok) throw new Error('Lemon Squeezy: returnToken is required for mobile checkout');
            return `${base}/payment/return/${encodeURIComponent(tok)}`;
          })()
        : `${base}/checkout/return?orderId=${encodeURIComponent(input.orderId)}`;

    await this.assertVariantMatchesStore(variantId, storeId);

    const checkoutBody = (testMode: boolean) =>
      JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            test_mode: testMode,
            custom_price: cents,
            product_options: {
              redirect_url: redirectUrl,
            },
            checkout_data: {
              custom: { orderId: input.orderId },
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: String(storeId) },
            },
            variant: {
              data: { type: 'variants', id: String(variantId) },
            },
          },
        },
      });

    let testMode = this.config.lemonSqueezeCheckoutTestMode;
    let rawText = '';
    let res!: Response;

    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(`${LEMON_API}/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        body: checkoutBody(testMode),
      });
      rawText = await res.text();

      if (res.ok) {
        break;
      }

      if (attempt === 0 && isVariantRelationship404(res.status, rawText)) {
        const prev = testMode;
        testMode = !testMode;
        console.warn(
          `[lemon-squeeze] variant 404 with test_mode=${prev}; retrying checkout with test_mode=${testMode}`,
        );
        continue;
      }

      console.error('[lemon-squeeze] API error', res.status, 'test_mode:', testMode, rawText.slice(0, 4000));
      const summary = summarizeLemonApiError(rawText);
      throw new Error(`Lemon Squeezy: ${summary}${notFoundHint(summary)}`);
    }

    if (!res.ok) {
      console.error('[lemon-squeeze] API error', res.status, 'test_mode:', testMode, rawText.slice(0, 4000));
      const summary = summarizeLemonApiError(rawText);
      throw new Error(`Lemon Squeezy: ${summary}${notFoundHint(summary)}`);
    }

    let json: {
      data?: { id?: string; attributes?: { url?: string } };
    };
    try {
      json = JSON.parse(rawText) as typeof json;
    } catch {
      throw new Error('Lemon Squeezy: invalid JSON response');
    }

    const id = json.data?.id;
    const checkoutUrl = json.data?.attributes?.url;
    if (!id) throw new Error('Lemon Squeezy: missing checkout id in response');
    if (!checkoutUrl) {
      console.error('[lemon-squeeze] missing url', rawText.slice(0, 2000));
      throw new Error('Lemon Squeezy: no checkout URL in response');
    }

    return {
      providerPaymentId: String(id),
      status: 'pending',
      checkoutUrl,
      successRedirectUrl: redirectUrl,
    };
  }

  /** Same algorithm as https://docs.lemonsqueezy.com/help/webhooks/signing-requests (hex digest, UTF-8 bytes). */
  verifyWebhook(payload: string | Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret || signature == null || signature === '') return false;
    const bodyBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
    const digestHex = crypto.createHmac('sha256', this.webhookSecret).update(bodyBuf).digest('hex');
    const digestBuf = Buffer.from(digestHex, 'utf8');
    const sigBuf = Buffer.from(signature.trim(), 'utf8');
    if (sigBuf.length !== digestBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, digestBuf);
  }

  async handleWebhook(payload: unknown): Promise<{ orderId: string; status: 'completed' | 'failed' } | null> {
    const p = payload as {
      meta?: { custom_data?: Record<string, unknown> };
      data?: { type?: string; attributes?: { status?: string } };
    };
    const custom = p.meta?.custom_data;
    const rawOrderId = custom?.orderId ?? custom?.order_id;
    const orderId = rawOrderId != null && String(rawOrderId).trim() !== '' ? String(rawOrderId).trim() : null;
    if (!orderId) return null;

    // Order-related webhooks ship an `orders` resource; other events may carry unrelated payloads.
    if (p.data?.type && p.data.type !== 'orders') return null;

    const status = p.data?.attributes?.status;
    if (status === 'paid') return { orderId, status: 'completed' };
    if (status === 'failed' || status === 'refunded' || status === 'voided') return { orderId, status: 'failed' };
    return null;
  }
}
