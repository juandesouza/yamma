import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export * from './schema';
