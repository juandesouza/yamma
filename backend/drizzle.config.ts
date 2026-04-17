import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

/** Migrations in `./drizzle` are generated from `src/db/schema.ts` and must match Nhost Postgres `public` tables. */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    /** Use for `db:migrate` when `.env.local` overrides `DATABASE_URL` (e.g. local Docker). */
    url:
      process.env.DRIZZLE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://localhost:5432/yamma',
  },
});
