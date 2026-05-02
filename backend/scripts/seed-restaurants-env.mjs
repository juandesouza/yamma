#!/usr/bin/env node
/**
 * Seed demo restaurants using DATABASE_URL from backend/.env only (ignores .env.local).
 * Matches db:migrate:env behavior so Docker/local Postgres in .env.local does not win.
 *
 * Usage: pnpm --filter backend run seed:restaurants:env
 */
import { spawnSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

config({ path: path.join(backendRoot, '.env') });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in backend/.env');
  process.exit(1);
}

const script = path.join(__dirname, 'seed-restaurants.mjs');
const r = spawnSync(process.execPath, [script], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: url,
  },
});
process.exit(r.status ?? 1);
