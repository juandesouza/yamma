/**
 * Lucia auth setup – session-based, PostgreSQL
 * Compatible with web (cookies) and mobile (Bearer token via session id)
 */

import { Lucia } from 'lucia';
import { Pool } from 'pg';
import type { User, Session } from './auth.types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getLucia(secret: string) {
  const adapter = {
    getSession: async (sessionId: string): Promise<Session | null> => {
      const r = await pool.query(
        `SELECT id, user_id as "userId", expires_at as "expiresAt" FROM sessions WHERE id = $1 AND expires_at > NOW()`,
        [sessionId]
      );
      const row = r.rows[0] as any;
      if (!row) return null;
      return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
    },
    getSessionsByUserId: async (userId: string) => {
      const r = await pool.query(
        `SELECT id, user_id as "userId", expires_at as "expiresAt" FROM sessions WHERE user_id = $1 AND expires_at > NOW()`,
        [userId]
      );
      return r.rows.map((row: any) => ({ id: row.id, userId: row.userId, expiresAt: row.expiresAt }));
    },
    setSession: async (session: Session): Promise<void> => {
      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET user_id = $2, expires_at = $3, updated_at = NOW()`,
        [session.id, session.userId, session.expiresAt]
      );
    },
    deleteSession: async (sessionId: string): Promise<void> => {
      await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    },
    deleteSessionsByUserId: async (userId: string): Promise<void> => {
      await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    },
    getUser: async (userId: string): Promise<User | null> => {
      const r = await pool.query(
        `SELECT id, email, phone, name, avatar_url as "avatarUrl", role FROM users WHERE id = $1`,
        [userId]
      );
      const row = r.rows[0] as any;
      if (!row) return null;
      return {
        id: row.id,
        email: row.email ?? undefined,
        phone: row.phone ?? undefined,
        name: row.name,
        avatarUrl: row.avatarUrl ?? undefined,
        role: row.role,
      };
    },
  };

  return new Lucia(adapter as any, {
    sessionCookie: {
      name: 'yamma_session',
      expires: false,
      attributes: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    },
    getUserAttributes: (attrs) => ({ ...attrs }),
  });
}

export type LuciaInstance = Awaited<ReturnType<typeof getLucia>>;
