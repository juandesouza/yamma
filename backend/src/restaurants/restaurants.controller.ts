import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { SELLER_GUEST_USER_EMAIL } from '../auth/guest.constants';
import { z } from 'zod';

const createMyRestaurantSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  cuisine: z.string().max(80).optional(),
  address: z.string().min(5).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  imageUrl: z
    .string()
    .max(2000)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: 'imageUrl must be an http(s) URL' }),
});

const addMenuItemSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.number().positive().max(1_000_000),
});

const updateMyRestaurantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  cuisine: z.string().max(80).optional(),
  address: z.string().min(5).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  imageUrl: z
    .string()
    .max(2000)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: 'imageUrl must be an http(s) URL' }),
});

@Controller('restaurants')
export class RestaurantsController {
  constructor(private restaurants: RestaurantsService) {}

  @Get('mine')
  @UseGuards(SessionGuard)
  async mine(@CurrentUser() user: SessionUser) {
    if (user.role !== 'restaurant') {
      throw new ForbiddenException('Only seller accounts have a restaurant profile');
    }
    // Seller guest: ensure demo Miami restaurant exists even if they never re-did guest login after deploy.
    if ((user.email ?? '').toLowerCase() === SELLER_GUEST_USER_EMAIL.toLowerCase()) {
      try {
        await this.restaurants.seedGuestSellerDemoIfNeeded(user.id);
      } catch (e) {
        console.error('[restaurants/mine] guest seller seed failed', e);
      }
    }
    const data = await this.restaurants.getMineWithMenus(user.id);
    return data ?? { restaurant: null, menus: [] };
  }

  @Post('mine')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createMine(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    if (user.role !== 'restaurant') {
      throw new ForbiddenException('Only seller accounts can create a restaurant');
    }
    const data = createMyRestaurantSchema.parse(body);
    const row = await this.restaurants.createForOwner(user.id, {
      name: data.name,
      description: data.description,
      cuisine: data.cuisine,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      imageUrl: data.imageUrl?.trim() || undefined,
    });
    return row;
  }

  @Post('mine/menu-items')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async addMenuItem(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    if (user.role !== 'restaurant') {
      throw new ForbiddenException('Only sellers can add menu items');
    }
    const data = addMenuItemSchema.parse(body);
    return this.restaurants.addMenuItemForOwner(user.id, {
      name: data.name,
      description: data.description,
      price: data.price,
    });
  }

  @Patch('mine')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async updateMine(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    if (user.role !== 'restaurant') {
      throw new ForbiddenException('Only sellers can update restaurant profile');
    }
    const data = updateMyRestaurantSchema.parse(body);
    return this.restaurants.updateForOwner(user.id, data);
  }

  @Get()
  async list(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    // Default: East US (Washington, DC) when no coords (e.g. server-side fetch)
    const latitude =
      lat !== undefined && lat !== '' && !Number.isNaN(parseFloat(lat)) ? parseFloat(lat) : 38.9072;
    const longitude =
      lng !== undefined && lng !== '' && !Number.isNaN(parseFloat(lng)) ? parseFloat(lng) : -77.0369;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 120;
    const offset =
      offsetRaw !== undefined && offsetRaw !== '' && !Number.isNaN(parseInt(offsetRaw, 10))
        ? parseInt(offsetRaw, 10)
        : 0;
    return this.restaurants.findNearby(latitude, longitude, limit, offset);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const r = await this.restaurants.findOne(id);
    if (!r) return { error: 'Not found' };
    return r;
  }

  @Get(':id/menus')
  async menus(@Param('id') id: string) {
    return this.restaurants.getMenus(id);
  }
}
