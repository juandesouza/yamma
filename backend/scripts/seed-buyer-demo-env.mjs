#!/usr/bin/env node
/**
 * Seed fake restaurants + menus for the buyer homepage (hosted DB).
 * Uses DATABASE_URL from backend/.env only — same as db:migrate:env.
 *
 * The public /restaurants API only returns venues with at least one
 * available menu item, so both steps are required.
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

const env = { ...process.env, DATABASE_URL: url };

for (const name of ['seed-restaurants.mjs', 'seed-menus.mjs']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, name)], {
    cwd: backendRoot,
    stdio: 'inherit',
    env,
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}
