#!/usr/bin/env node
/**
 * Seed menus + items using DATABASE_URL from backend/.env only (ignores .env.local).
 */
import { spawnSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbHostnameFromUrl } from './db-errors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

config({ path: path.join(backendRoot, '.env') });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in backend/.env');
  process.exit(1);
}

const hostHint = dbHostnameFromUrl(url);
console.info(
  `[seed:menus:env] Using DATABASE_URL from backend/.env (${hostHint ? `host ${hostHint}` : 'hostname not parsed'}) — then running seed-menus…`
);

const r = spawnSync(process.execPath, [path.join(__dirname, 'seed-menus.mjs')], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(r.status ?? 1);
