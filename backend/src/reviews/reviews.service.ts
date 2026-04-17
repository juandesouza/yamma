import { Injectable } from '@nestjs/common';
import { createDb } from '../db';
import { reviews } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ReviewsService {
  private db = createDb(process.env.DATABASE_URL!);

  async create(orderId: string, userId: string, restaurantId: string, rating: number, comment?: string) {
    const [r] = await this.db.insert(reviews).values({
      orderId,
      userId,
      restaurantId,
      rating,
      comment,
    }).returning();
    return r;
  }

  async findByRestaurant(restaurantId: string, limit = 50) {
    return this.db
      .select()
      .from(reviews)
      .where(eq(reviews.restaurantId, restaurantId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  async getAverageRating(restaurantId: string): Promise<number> {
    const list = await this.findByRestaurant(restaurantId, 500);
    if (list.length === 0) return 0;
    const sum = list.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / list.length) * 10) / 10;
  }
}
