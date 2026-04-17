import { BadRequestException, Injectable } from '@nestjs/common';
import { createDb } from '../db';
import { driverAssignments, drivers, orders } from '../db/schema';
import { asc, eq } from 'drizzle-orm';
import type { DriverLocationUpdate, DeliveryWebhookPayload } from './delivery.types';
import { OrdersService } from '../orders/orders.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DeliveryService {
  private db = createDb(process.env.DATABASE_URL!);

  constructor(private readonly ordersService: OrdersService) {}

  /** Resolve driverId (UUID or external app id) to drivers.id */
  async resolveDriverId(driverIdOrExternalId: string): Promise<string> {
    if (UUID_REGEX.test(driverIdOrExternalId)) {
      const [d] = await this.db.select().from(drivers).where(eq(drivers.id, driverIdOrExternalId)).limit(1);
      if (d) return d.id;
    }
    const [d] = await this.db.select().from(drivers).where(eq(drivers.externalId, driverIdOrExternalId)).limit(1);
    if (d) return d.id;
    const [created] = await this.db
      .insert(drivers)
      .values({ externalId: driverIdOrExternalId, name: `Driver ${driverIdOrExternalId.slice(0, 8)}`, status: 'available' })
      .returning({ id: drivers.id });
    if (!created) throw new Error('Failed to create driver');
    return created.id;
  }

  async assignDriver(orderId: string, driverIdOrExternalId: string) {
    const driverId = await this.resolveDriverId(driverIdOrExternalId);
    const [a] = await this.db.insert(driverAssignments).values({
      orderId,
      driverId,
      status: 'assigned',
    }).returning();
    return a;
  }

  async updateDriverLocation(update: DriverLocationUpdate) {
    const driverId = await this.resolveDriverId(update.driverId);
    await this.db
      .update(driverAssignments)
      .set({
        currentLatitude: String(update.latitude),
        currentLongitude: String(update.longitude),
        updatedAt: new Date(),
      })
      .where(eq(driverAssignments.orderId, update.orderId));
  }

  async handleWebhook(payload: DeliveryWebhookPayload): Promise<boolean> {
    const { orderId, event, driverId: driverIdOrExternalId, location, eta } = payload;
    const driverId = await this.resolveDriverId(driverIdOrExternalId);
    if (event === 'accepted') {
      const r = await this.ordersService.markInTransitFromPartner(orderId);
      if ('error' in r && r.error === 'not_found') throw new BadRequestException('Order not found');
      if ('error' in r && (r.error === 'no_handoff' || r.error === 'invalid_status')) {
        throw new BadRequestException(r.message ?? 'Cannot mark in transit');
      }
    }
    if (event === 'accepted' || event === 'assigned') {
      const existing = await this.getAssignment(orderId);
      if (!existing) {
        await this.assignDriver(orderId, driverIdOrExternalId);
      }
      await this.db
        .update(driverAssignments)
        .set({ status: event === 'accepted' ? 'accepted' : 'assigned', updatedAt: new Date() })
        .where(eq(driverAssignments.orderId, orderId));
    }
    if (event === 'picked_up') {
      await this.db
        .update(driverAssignments)
        .set({ status: 'picked_up', updatedAt: new Date() })
        .where(eq(driverAssignments.orderId, orderId));
    }
    if (event === 'in_transit' && location) {
      await this.db.update(orders).set({ status: 'in_transit', updatedAt: new Date() }).where(eq(orders.id, orderId));
      await this.db
        .update(driverAssignments)
        .set({
          status: 'in_transit',
          currentLatitude: String(location.lat),
          currentLongitude: String(location.lng),
          estimatedArrival: eta ? new Date(eta) : null,
          updatedAt: new Date(),
        })
        .where(eq(driverAssignments.orderId, orderId));
    }
    if (event === 'delivered') {
      await this.db.update(orders).set({ status: 'delivered', updatedAt: new Date() }).where(eq(orders.id, orderId));
      await this.db
        .update(driverAssignments)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(driverAssignments.orderId, orderId));
    }
    if (event === 'cancelled') {
      await this.db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, orderId));
      await this.db
        .update(driverAssignments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(driverAssignments.orderId, orderId));
    }
    return true;
  }

  async getAssignment(orderId: string) {
    const [a] = await this.db
      .select()
      .from(driverAssignments)
      .where(eq(driverAssignments.orderId, orderId))
      .limit(1);
    return a ?? null;
  }

  async getAssignmentWithDriver(orderId: string) {
    const [a] = await this.db
      .select({
        assignment: driverAssignments,
        driver: drivers,
      })
      .from(driverAssignments)
      .innerJoin(drivers, eq(driverAssignments.driverId, drivers.id))
      .where(eq(driverAssignments.orderId, orderId))
      .limit(1);
    return a ?? null;
  }

  async findDriverById(id: string) {
    const [d] = await this.db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
    return d ?? null;
  }

  async listDrivers(status?: string) {
    if (status) {
      return this.db.select().from(drivers).where(eq(drivers.status, status)).orderBy(asc(drivers.name));
    }
    return this.db.select().from(drivers).orderBy(asc(drivers.name));
  }
}
