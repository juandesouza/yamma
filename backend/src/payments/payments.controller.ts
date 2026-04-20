import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Body,
  Req,
  Headers,
  RawBodyRequest,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { z } from 'zod';

const createSchema = z
  .object({
    orderId: z.string().uuid(),
    provider: z.literal('lemon_squeeze'),
    /** Mobile app uses an HTTPS → app scheme bridge; web uses default checkout return. */
    checkoutSuccessTarget: z.enum(['web', 'mobile']).optional(),
    /**
     * Public HTTPS origin of the Next app (serves `/payment/app-redirect`). Required for reliable
     * mobile return when `FRONTEND_URL` is localhost — the phone browser cannot open localhost.
     */
    paymentReturnBaseUrl: z.string().min(1).optional(),
    /** Required for mobile: full `exp://` or `yamma://` URL from `Linking.createURL` (stored server-side). */
    mobileAppResumeUrl: z.string().min(1).max(4096).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.checkoutSuccessTarget === 'mobile' && !data.mobileAppResumeUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mobileAppResumeUrl is required when checkoutSuccessTarget is mobile',
        path: ['mobileAppResumeUrl'],
      });
    }
  });

const devConfirmReturnSchema = z.object({
  orderId: z.string().uuid(),
});

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private payments: PaymentsService) {}

  @Post('create')
  @UseGuards(SessionGuard)
  async create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.payments.createPayment(
      parsed.data.orderId,
      parsed.data.provider,
      user.id,
      {
        checkoutSuccessTarget: parsed.data.checkoutSuccessTarget,
        paymentReturnBaseUrl: parsed.data.paymentReturnBaseUrl,
        mobileAppResumeUrl: parsed.data.mobileAppResumeUrl,
      },
    );
  }

  @Post('webhooks/lemon-squeeze')
  async lemonWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-event-name') eventName: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw)) {
      throw new BadRequestException(
        'Webhook raw body missing. Ensure NestFactory.create(..., { rawBody: true }) in main.ts.',
      );
    }
    const provider = this.payments.getProvider();
    this.logger.log(`Lemon webhook received event=${eventName ?? 'unknown'} bytes=${raw.length}`);
    if (!provider.verifyWebhook(raw, signature)) {
      this.logger.warn(`Lemon webhook signature invalid event=${eventName ?? 'unknown'}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }
    const result = await provider.handleWebhook(payload);
    if (result) {
      this.logger.log(`Lemon webhook mapped orderId=${result.orderId} status=${result.status}`);
      await this.payments.confirmPayment(result.orderId, result.status);
    } else {
      this.logger.log(`Lemon webhook ignored event=${eventName ?? 'unknown'} (no order mapping)`);
    }
    return { received: true };
  }

  /** Confirms a paid Lemon order when webhooks are slow or unreachable (uses Lemon Orders API). */
  @Post('lemon/sync-order')
  @UseGuards(SessionGuard)
  async syncLemonOrder(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = devConfirmReturnSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.syncLemonOrderAfterCheckout(parsed.data.orderId, user.id);
  }

  @Post('dev/confirm-lemon-return')
  @UseGuards(SessionGuard)
  async devConfirmLemonReturn(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = devConfirmReturnSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.syncLemonOrderAfterCheckout(parsed.data.orderId, user.id);
  }
}
