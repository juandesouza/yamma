import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createDb } from '../db';
import { users, sessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { User, Session as SessionType } from './auth.types';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class AuthService {
  private db;

  constructor(private config: ConfigService) {
    this.db = createDb(config.databaseUrl);
  }

  async createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt,
    });
    return { sessionId, expiresAt };
  }

  async validateSession(sessionId: string): Promise<{ user: User } | null> {
    if (!sessionId) return null;
    const [sessionRow] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!sessionRow) return null;
    const [userRow] = await this.db.select().from(users).where(eq(users.id, sessionRow.userId)).limit(1);
    if (!userRow) return null;
    const user: User = {
      id: userRow.id,
      email: userRow.email ?? undefined,
      phone: userRow.phone ?? undefined,
      name: userRow.name,
      avatarUrl: userRow.avatarUrl ?? undefined,
      role: userRow.role as User['role'],
    };
    return { user };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  getSessionFromRequest(req: { cookies?: Record<string, string>; headers?: { authorization?: string } }): string | null {
    const cookie = req.cookies?.['yamma_session'];
    if (cookie) return cookie;
    const auth = req.headers?.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
