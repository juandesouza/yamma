import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentReturnBridgeController } from './payment-return-bridge.controller';
import { LemonSqueezeProvider } from './providers/lemon-squeeze.provider';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/guards/session.guard';

@Module({
  imports: [OrdersModule, AuthModule],
  providers: [PaymentsService, LemonSqueezeProvider, SessionGuard],
  controllers: [PaymentsController, PaymentReturnBridgeController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
