import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';

const APP_SCHEME = 'yamma';

function parseResumeTarget(toParam: string | undefined): string | null {
  if (!toParam?.trim()) return null;
  let t = toParam.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== 'exp:' && u.protocol !== 'yamma:') return null;
    return t;
  } catch {
    return null;
  }
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function sendResumeHtml(res: Response, target: string) {
  const href = escapeHtmlAttr(target);
  const js = JSON.stringify(target);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="refresh" content="0;url=${href}"/><title>Yamma</title></head><body style="margin:0;background:#0f1014;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:32px 16px"><p style="font-size:17px;margin:0 0 12px">Opening Yamma…</p><p style="margin:0;font-size:14px;opacity:.75">If nothing happens, tap below.</p><p style="margin-top:20px"><a href="${href}" style="color:#ff9a66;font-weight:600;font-size:16px">Open in app</a></p><script>try{location.replace(${js});}catch(e){}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(html);
}

/**
 * After Lemon checkout, the buyer hits a **short** HTTPS URL (under 255 chars). We load the real
 * `exp://…` or `yamma://…` link from the DB and send a minimal page that opens the app immediately.
 */
@Controller('payment')
export class PaymentReturnBridgeController {
  constructor(private readonly payments: PaymentsService) {}

  /** Preferred: token maps to full deep link from `Linking.createURL` (works in Expo Go + dev builds). */
  @Get('return/:token')
  async returnToApp(@Param('token') token: string, @Res() res: Response) {
    const target = await this.payments.getMobileResumeUrlByReturnToken(token);
    if (!target) {
      res
        .status(404)
        .type('html')
        .send(
          '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="background:#0f1014;color:#e5e7eb;font-family:system-ui;padding:24px;text-align:center"><p>Link expired or invalid.</p><p style="opacity:.7;font-size:14px;margin-top:12px">Open Yamma from your home screen and check Profile → Orders.</p></body></html>',
        );
      return;
    }
    sendResumeHtml(res, target);
  }

  /** Legacy query-string bridge (still supported for old Lemon redirect URLs). */
  @Get('app-redirect')
  appRedirect(
    @Query('orderId') orderId: string | undefined,
    @Query('to') to: string | undefined,
    @Query('restaurantId') restaurantId: string | undefined,
    @Res() res: Response,
  ) {
    const resume = parseResumeTarget(to);
    const id = orderId?.trim();
    const rid = restaurantId?.trim();
    const fallback = id
      ? `${APP_SCHEME}://payment-return?orderId=${encodeURIComponent(id)}${
          rid ? `&restaurantId=${encodeURIComponent(rid)}` : ''
        }`
      : null;
    const redirect = resume ?? fallback;
    if (!redirect) {
      res
        .status(400)
        .type('html')
        .send(
          '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="background:#0f1014;color:#e5e7eb;font-family:system-ui;padding:24px;text-align:center"><p>Missing return target.</p></body></html>',
        );
      return;
    }
    sendResumeHtml(res, redirect);
  }
}
