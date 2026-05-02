import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createDb } from '../db';
import { users, orders, payments, sessions } from '../db/schema';
import { eq, or, desc, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import type { Role } from '../auth/auth.types';
import {
  BUYER_GUEST_USER_EMAIL,
  BUYER_GUEST_USER_NAME,
  GUEST_PASSWORD_BCRYPT_HASH,
  isGuestUserEmail,
  SELLER_GUEST_USER_EMAIL,
  SELLER_GUEST_USER_NAME,
} from '../auth/guest.constants';

const SALT_ROUNDS = 10;

export interface CreateUserInput {
  email?: string;
  phone?: string;
  name: string;
  password: string;
  role?: 'customer' | 'restaurant' | 'admin' | 'driver';
}

@Injectable()
export class UsersService {
  private readonly db: ReturnType<typeof createDb>;

  constructor(private readonly config: ConfigService) {
    this.db = createDb(this.config.databaseUrl);
  }

  async create(input: CreateUserInput) {
    const conditions = [
      input.email ? eq(users.email, input.email) : null,
      input.phone ? eq(users.phone, input.phone) : null,
    ].filter(Boolean) as ReturnType<typeof eq>[];
    if (conditions.length) {
      const [existing] = await this.db.select().from(users).where(or(...conditions)).limit(1);
      if (existing) throw new ConflictException('User with this email or phone already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const [u] = await this.db.insert(users).values({
      email: input.email,
      phone: input.phone,
      passwordHash,
      name: input.name,
      role: input.role ?? 'customer',
    }).returning();
    if (!u) throw new Error('Insert failed');
    return { id: u.id, email: u.email, phone: u.phone, name: u.name, role: u.role };
  }

  /** Ensures guest row exists for buyer/seller guest-session login. */
  async ensureGuestUser(
    role: 'buyer' | 'seller' = 'buyer',
  ): Promise<{ id: string; email: string | undefined; name: string; role: Role }> {
    const targetEmail = role === 'seller' ? SELLER_GUEST_USER_EMAIL : BUYER_GUEST_USER_EMAIL;
    const targetName = role === 'seller' ? SELLER_GUEST_USER_NAME : BUYER_GUEST_USER_NAME;
    const targetRole: Role = role === 'seller' ? 'restaurant' : 'customer';
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1);
    if (existing) {
      return {
        id: existing.id,
        email: existing.email ?? undefined,
        name: existing.name,
        role: existing.role as Role,
      };
    }
    const [u] = await this.db
      .insert(users)
      .values({
        email: targetEmail,
        passwordHash: GUEST_PASSWORD_BCRYPT_HASH,
        name: targetName,
        role: targetRole,
      })
      .returning();
    if (!u) throw new Error('Guest user insert failed');
    return { id: u.id, email: u.email ?? undefined, name: u.name, role: u.role as Role };
  }

  async validatePassword(emailOrPhone: string, password: string) {
    const [u] = await this.db.select().from(users).where(
      or(eq(users.email, emailOrPhone), eq(users.phone, emailOrPhone))
    ).limit(1);
    if (!u?.passwordHash) return null;
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return null;
    return { id: u.id, email: u.email ?? undefined, phone: u.phone ?? undefined, name: u.name, role: u.role };
  }

  async findByEmail(email: string) {
    const normalized = email.toLowerCase();
    const [u] = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1);
    if (!u) return null;
    return { id: u.id, email: u.email ?? undefined, name: u.name, role: u.role as Role };
  }

  async createGoogleUser(input: { email: string; name: string }) {
    const email = input.email.toLowerCase();
    const [u] = await this.db
      .insert(users)
      .values({
        email,
        name: input.name,
        role: 'customer',
        cryptoPayoutPercent: 0,
        cryptoBalance: '0',
        fiatBalance: '0',
      })
      .returning();
    if (!u) throw new Error('Google user insert failed');
    return { id: u.id, email: u.email ?? undefined, name: u.name, role: u.role as Role };
  }

  async findById(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return u ?? null;
  }

  async updatePasswordByUserId(userId: string, plainPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // Invalidate all existing sessions so the new password becomes authoritative immediately.
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async listByRoles(roles?: Role[]) {
    if (!roles?.length) {
      return this.db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
    }

    const clauses = roles.map((role) => eq(users.role, role));
    return this.db
      .select()
      .from(users)
      .where(or(...clauses))
      .orderBy(desc(users.createdAt))
      .limit(200);
  }

  async updateRole(userId: string, role: Role) {
    const [updated] = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated ?? null;
  }

  /**
   * Removes the user row after clearing their orders (as buyer) and sessions.
   * Seller and admin accounts are not self-deletable here; guest is forbidden.
   */
  async deleteMyAccount(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (isGuestUserEmail(user.email)) {
      throw new ForbiddenException('The guest account cannot be deleted.');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('Admin accounts cannot be deleted from the app.');
    }
    if (user.role === 'restaurant') {
      throw new BadRequestException('Seller accounts cannot be deleted from the app. Contact support.');
    }

    const userOrderRows = await this.db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
    const orderIds = userOrderRows.map((r) => r.id);
    if (orderIds.length > 0) {
      await this.db.delete(payments).where(inArray(payments.orderId, orderIds));
    }
    await this.db.delete(orders).where(eq(orders.userId, userId));

    await this.db.delete(sessions).where(eq(sessions.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
