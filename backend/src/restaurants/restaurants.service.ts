import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createDb } from '../db';
import { restaurants, menus, menuItems } from '../db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface CreateRestaurantForOwnerInput {
  name: string;
  description?: string;
  cuisine?: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
}

export interface AddMenuItemForOwnerInput {
  name: string;
  description?: string;
  price: number;
}

export interface UpdateRestaurantForOwnerInput {
  name?: string;
  description?: string;
  cuisine?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
}

/** Matches buyer home `FALLBACK_LAT` / `FALLBACK_LNG` so guest buyers see this venue without scrolling past 100+ seeded rows. */
const GUEST_SELLER_DEMO_LAT = '38.9028000';
const GUEST_SELLER_DEMO_LNG = '-77.0365000';

/** Unsplash source photos for guest-seller demo items (prior IDs returned 404 via imgix). */
const GUEST_SELLER_MENU_IMAGE_STREET_CORN =
  'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80';
const GUEST_SELLER_MENU_IMAGE_KEY_LIME_TART =
  'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80';

@Injectable()
export class RestaurantsService {
  private db = createDb(process.env.DATABASE_URL!);

  private makeSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'restaurant';
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  async findByOwnerId(ownerId: string) {
    const [r] = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.ownerId, ownerId))
      .limit(1);
    return r ?? null;
  }

  /**
   * Ensures the shared seller guest account has a ready-to-use demo restaurant with menu and images.
   * Placed near Washington, DC (same default map center as buyer guest) so it appears in the first pages of the buyer list.
   */
  async seedGuestSellerDemoIfNeeded(ownerId: string): Promise<void> {
    let r = await this.findByOwnerId(ownerId);
    if (r) {
      await this.relocateLegacyGuestSellerFromMiamiIfNeeded(r);
      r = (await this.findByOwnerId(ownerId))!;
      await this.patchGuestSellerKitchenMenuImages(r.id);

      const sellable = await this.db
        .select({ id: menuItems.id })
        .from(menuItems)
        .innerJoin(menus, eq(menuItems.menuId, menus.id))
        .where(and(eq(menus.restaurantId, r.id), eq(menuItems.available, true)))
        .limit(1);
      if (sellable.length > 0) return;

      const anyItems = await this.db
        .select({ id: menuItems.id })
        .from(menuItems)
        .innerJoin(menus, eq(menuItems.menuId, menus.id))
        .where(eq(menus.restaurantId, r.id));
      if (anyItems.length === 0) {
        await this.insertGuestDemoMenuForRestaurant(r.id);
      } else {
        const ids = anyItems.map((row) => row.id);
        await this.db
          .update(menuItems)
          .set({ available: true, updatedAt: new Date() })
          .where(inArray(menuItems.id, ids));
      }
      return;
    }

    const slug = this.makeSlug('Guest Seller Kitchen');
    const [restaurant] = await this.db
      .insert(restaurants)
      .values({
        ownerId,
        name: 'Guest Seller Kitchen [demo]',
        slug,
        description:
          'Pre-seeded demo for guest seller — Latin menu with photos. Near DC so buyer guests see it in their nearby list.',
        cuisine: 'Latin / Mexican',
        address: '700 Pennsylvania Avenue NW, Washington, DC 20004',
        latitude: GUEST_SELLER_DEMO_LAT,
        longitude: GUEST_SELLER_DEMO_LNG,
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
        isOpen: true,
      })
      .returning();
    if (!restaurant) throw new Error('Guest restaurant seed failed');
    await this.insertGuestDemoMenuForRestaurant(restaurant.id);
  }

  /** Older seeds used Miami; buyers use a DC map fallback → venue never appeared in early pages. */
  private async relocateLegacyGuestSellerFromMiamiIfNeeded(
    r: NonNullable<Awaited<ReturnType<RestaurantsService['findByOwnerId']>>>,
  ): Promise<void> {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    const legacySouthFlorida = lat < 28.5 && lng < -78.5 && lng > -82.5;
    if (!legacySouthFlorida) return;
    await this.db
      .update(restaurants)
      .set({
        name: 'Guest Seller Kitchen [demo]',
        description:
          'Pre-seeded demo for guest seller — Latin menu with photos. Near DC so buyer guests see it in their nearby list.',
        cuisine: 'Latin / Mexican',
        address: '700 Pennsylvania Avenue NW, Washington, DC 20004',
        latitude: GUEST_SELLER_DEMO_LAT,
        longitude: GUEST_SELLER_DEMO_LNG,
        updatedAt: new Date(),
      })
      .where(eq(restaurants.id, r.id));
  }

  /** Refreshes image URLs when Unsplash/imgix drops older photo IDs (idempotent). */
  private async patchGuestSellerKitchenMenuImages(restaurantId: string): Promise<void> {
    const restaurantMenus = await this.db
      .select({ id: menus.id })
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId));
    const menuIdList = restaurantMenus.map((m) => m.id);
    if (menuIdList.length === 0) return;
    const now = new Date();
    await this.db
      .update(menuItems)
      .set({ imageUrl: GUEST_SELLER_MENU_IMAGE_STREET_CORN, updatedAt: now })
      .where(
        and(eq(menuItems.name, 'Street Corn Esquites'), inArray(menuItems.menuId, menuIdList)),
      );
    await this.db
      .update(menuItems)
      .set({ imageUrl: GUEST_SELLER_MENU_IMAGE_KEY_LIME_TART, updatedAt: now })
      .where(and(eq(menuItems.name, 'Key Lime Tart'), inArray(menuItems.menuId, menuIdList)));
  }

  private async insertGuestDemoMenuForRestaurant(restaurantId: string): Promise<void> {
    let [menu] = await this.db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(asc(menus.sortOrder))
      .limit(1);
    if (!menu) {
      const [created] = await this.db
        .insert(menus)
        .values({
          restaurantId,
          name: 'Main menu',
          sortOrder: 0,
        })
        .returning();
      menu = created!;
    }

    const existing = await this.db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, menu.id)).limit(1);
    if (existing.length > 0) return;

    const dishes: { name: string; description: string; price: string; imageUrl: string }[] = [
      {
        name: 'Miami Cubano Sandwich',
        description: 'Pressed ham, roast pork, Swiss, pickles, mustard — classic Florida.',
        price: '14.99',
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80',
      },
      {
        name: 'Ropa Vieja Bowl',
        description: 'Braised beef, white rice, black beans, sweet plantains.',
        price: '16.99',
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
      },
      {
        name: 'Fish Tacos (3)',
        description: 'Grilled mahi, cabbage slaw, lime crema, corn tortillas.',
        price: '13.50',
        imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=80',
      },
      {
        name: 'Street Corn Esquites',
        description: 'Charred corn, cotija, mayo-lime, chili powder.',
        price: '7.99',
        imageUrl: GUEST_SELLER_MENU_IMAGE_STREET_CORN,
      },
      {
        name: 'Key Lime Tart',
        description: 'Tart Florida key lime, graham crust, whipped cream.',
        price: '6.99',
        imageUrl: GUEST_SELLER_MENU_IMAGE_KEY_LIME_TART,
      },
    ];

    for (let i = 0; i < dishes.length; i += 1) {
      const d = dishes[i];
      await this.db.insert(menuItems).values({
        menuId: menu.id,
        name: d.name,
        description: d.description,
        imageUrl: d.imageUrl,
        price: d.price,
        sortOrder: i,
        available: true,
      });
    }
  }

  async createForOwner(ownerId: string, input: CreateRestaurantForOwnerInput) {
    const existing = await this.findByOwnerId(ownerId);
    if (existing) {
      throw new ConflictException('You already have a restaurant profile. Add menu items below.');
    }
    const slug = this.makeSlug(input.name);
    const [row] = await this.db
      .insert(restaurants)
      .values({
        ownerId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        cuisine: input.cuisine?.trim() || null,
        address: input.address.trim(),
        latitude: input.latitude.toFixed(7),
        longitude: input.longitude.toFixed(7),
        imageUrl: input.imageUrl?.trim() || null,
        isOpen: true,
      })
      .returning();
    if (!row) throw new Error('Restaurant insert failed');
    return row;
  }

  async addMenuItemForOwner(ownerId: string, input: AddMenuItemForOwnerInput) {
    const r = await this.findByOwnerId(ownerId);
    if (!r) throw new NotFoundException('Create your restaurant first');
    let [menu] = await this.db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, r.id))
      .orderBy(asc(menus.sortOrder))
      .limit(1);
    if (!menu) {
      const [created] = await this.db
        .insert(menus)
        .values({
          restaurantId: r.id,
          name: 'Menu',
          sortOrder: 0,
        })
        .returning();
      menu = created!;
    }
    const price = Math.round(input.price * 100) / 100;
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('Invalid price');
    }
    const [item] = await this.db
      .insert(menuItems)
      .values({
        menuId: menu.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        price: price.toFixed(2),
        sortOrder: 0,
        available: true,
      })
      .returning();
    if (!item) throw new Error('Menu item insert failed');
    return item;
  }

  async updateForOwner(ownerId: string, input: UpdateRestaurantForOwnerInput) {
    const r = await this.findByOwnerId(ownerId);
    if (!r) throw new NotFoundException('Create your restaurant first');
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description.trim() || null;
    if (input.cuisine !== undefined) patch.cuisine = input.cuisine.trim() || null;
    if (input.address !== undefined) patch.address = input.address.trim();
    if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl.trim() || null;
    if (input.latitude !== undefined) patch.latitude = input.latitude.toFixed(7);
    if (input.longitude !== undefined) patch.longitude = input.longitude.toFixed(7);
    const [updated] = await this.db
      .update(restaurants)
      .set(patch)
      .where(eq(restaurants.id, r.id))
      .returning();
    if (!updated) throw new NotFoundException('Restaurant not found');
    return updated;
  }

  async getMineWithMenus(ownerId: string) {
    const r = await this.findByOwnerId(ownerId);
    if (!r) return null;
    const menuPayload = await this.getMenus(r.id);
    return { restaurant: r, menus: menuPayload };
  }

  async findNearby(lat: number, lng: number, limit = 120, offset = 0) {
    const cap = Math.min(200, Math.max(1, limit));
    const skip = Math.max(0, Math.min(offset, 5000));
    const list = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.isOpen, true));
    const visible: typeof list = [];
    for (const r of list) {
      const [sellable] = await this.db
        .select({ id: menuItems.id })
        .from(menuItems)
        .innerJoin(menus, eq(menuItems.menuId, menus.id))
        .where(and(eq(menus.restaurantId, r.id), eq(menuItems.available, true)))
        .limit(1);
      if (sellable) visible.push(r);
    }
    const withDistance = visible.map((r) => ({
      ...r,
      distanceMiles: this.haversineMiles(lat, lng, Number(r.latitude), Number(r.longitude)),
    }));
    withDistance.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return withDistance.slice(skip, skip + cap).map(({ distanceMiles, ...r }) => ({
      ...r,
      distance: `${distanceMiles.toFixed(1)} mi`,
    }));
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    return row ?? null;
  }

  async getMenus(restaurantId: string) {
    const menuList = await this.db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(asc(menus.sortOrder));
    const result = [];
    for (const menu of menuList) {
      const items = await this.db
        .select()
        .from(menuItems)
        .where(eq(menuItems.menuId, menu.id))
        .orderBy(asc(menuItems.sortOrder));
      result.push({ ...menu, items });
    }
    return result;
  }

  private haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.7613; // mean Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
