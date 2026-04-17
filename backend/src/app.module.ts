import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PaymentsModule } from './payments/payments.module';
import { MapboxModule } from './mapbox/mapbox.module';
import { DeliveryModule } from './delivery/delivery.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    OrdersModule,
    ReviewsModule,
    PaymentsModule,
    MapboxModule,
    DeliveryModule,
    EventsModule,
  ],
})
export class AppModule {}
