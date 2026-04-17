import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { z } from 'zod';

const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Post()
  @UseGuards(SessionGuard)
  async create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const data = createReviewSchema.parse(body);
    return this.reviews.create(
      data.orderId,
      user.id,
      data.restaurantId,
      data.rating,
      data.comment
    );
  }

  @Get('restaurant/:restaurantId')
  async list(@Param('restaurantId') restaurantId: string) {
    return this.reviews.findByRestaurant(restaurantId);
  }

  @Get('restaurant/:restaurantId/rating')
  async rating(@Param('restaurantId') restaurantId: string) {
    const rating = await this.reviews.getAverageRating(restaurantId);
    return { rating };
  }
}
