import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { z } from 'zod';

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  deliveryAddress: z.string().min(5),
  deliveryLatitude: z.number().optional(),
  deliveryLongitude: z.number().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1),
    name: z.string(),
    unitPrice: z.string(),
  })).min(1),
  notes: z.string().optional(),
});

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @UseGuards(SessionGuard)
  async create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const data = createOrderSchema.parse(body);
    const order = await this.orders.create({
      userId: user.id,
      restaurantId: data.restaurantId,
      deliveryAddress: data.deliveryAddress,
      deliveryLatitude: data.deliveryLatitude,
      deliveryLongitude: data.deliveryLongitude,
      items: data.items,
      notes: data.notes,
    });
    return order;
  }

  @Get()
  @UseGuards(SessionGuard)
  async list(@CurrentUser() user: SessionUser) {
    return this.orders.findByUser(user.id);
  }

  @Get('restaurant')
  @UseGuards(SessionGuard)
  async listRestaurantOrders(@CurrentUser() user: SessionUser) {
    if (user.role !== 'restaurant') throw new ForbiddenException('Only sellers can access restaurant orders');
    const rows = await this.orders.findByRestaurantOwner(user.id);
    return rows.map(({ order, restaurant }) => ({
      ...order,
      restaurantName: restaurant.name,
    }));
  }

  @Post(':id/dispatch')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async dispatch(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    if (user.role !== 'restaurant') throw new ForbiddenException('Only sellers can dispatch orders');
    const result = await this.orders.requestCourierHandoff(id, user.id);
    if (result.error === 'not_found') throw new NotFoundException('Order not found');
    if (result.error === 'invalid_status' || result.error === 'already_dispatched') {
      throw new BadRequestException(result.message ?? 'Cannot notify delivery partner');
    }
    return {
      ok: true,
      order: result.order,
      dispatchPayload: result.dispatchPayload,
    };
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async get(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== user.id) throw new ForbiddenException('Not your order');
    const items = await this.orders.findItems(id);
    return { ...order, items };
  }
}
