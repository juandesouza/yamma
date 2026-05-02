#!/usr/bin/env node
/**
 * Seed restaurants + menus for local dev (.env then .env.local like other scripts).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

for (const name of ['seed-restaurants.mjs', 'seed-menus.mjs']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, name)], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}
