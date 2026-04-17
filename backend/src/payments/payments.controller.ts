import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Req,
  Headers,
  RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { z } from 'zod';

const createSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.literal('lemon_squeeze'),
  /** Mobile app uses an HTTPS → app scheme bridge; web uses default checkout return. */
  checkoutSuccessTarget: z.enum(['web', 'mobile']).optional(),
});

const devConfirmReturnSchema = z.object({
  orderId: z.string().uuid(),
});

@Controller('payments')
export class PaymentsController {
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
      parsed.data.checkoutSuccessTarget,
    );
  }

  @Post('webhooks/lemon-squeeze')
  async lemonWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string,
  ) {
    const raw = req.rawBody ?? (req as unknown as { body?: string }).body;
    const provider = this.payments.getProvider();
    if (!provider.verifyWebhook(raw ?? '', signature ?? '')) {
      return { error: 'Invalid signature' };
    }
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = await provider.handleWebhook(payload);
    if (result) await this.payments.confirmPayment(result.orderId, result.status);
    return { received: true };
  }

  @Post('dev/confirm-lemon-return')
  @UseGuards(SessionGuard)
  async devConfirmLemonReturn(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = devConfirmReturnSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.devConfirmLemonReturn(parsed.data.orderId, user.id);
  }
}
