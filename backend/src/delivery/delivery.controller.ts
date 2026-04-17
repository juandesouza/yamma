import { Controller, Get, Post, Body, Headers, Param, BadRequestException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { ConfigService } from '../config/config.service';
import crypto from 'crypto';
import type { DeliveryWebhookPayload } from './delivery.types';

@Controller('delivery')
export class DeliveryController {
  constructor(
    private delivery: DeliveryService,
    private config: ConfigService,
  ) {}

  @Get('drivers')
  async listDrivers(@Headers('x-status') status?: string) {
    return this.delivery.listDrivers(status ?? undefined);
  }

  @Get('drivers/:id')
  async getDriver(@Param('id') id: string) {
    const driver = await this.delivery.findDriverById(id);
    if (!driver) return { error: 'Not found' };
    return driver;
  }

  @Post('webhook')
  async webhook(
    @Body() body: DeliveryWebhookPayload,
    @Headers('x-delivery-signature') signature: string,
  ) {
    const secret = this.config.deliveryWebhookSecret;
    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      if (signature !== expected) throw new BadRequestException('Invalid signature');
    }
    await this.delivery.handleWebhook(body);
    return { received: true };
  }
}
