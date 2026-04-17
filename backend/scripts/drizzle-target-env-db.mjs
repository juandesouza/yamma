#!/usr/bin/env node
/**
 * Run drizzle-kit against DATABASE_URL from `.env` only (ignores `.env.local` overrides).
 * Usage: node scripts/drizzle-target-env-db.mjs migrate|push|studio|generate [extra-args...]
 */
import { spawnSync } from 'child_process';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

config({ path: path.join(backendRoot, '.env') });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in backend/.env');
  process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/drizzle-target-env-db.mjs <migrate|push|studio|generate> [...]');
  process.exit(1);
}

const r = spawnSync('npx', ['drizzle-kit', cmd, ...rest], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DRIZZLE_DATABASE_URL: url,
    DATABASE_URL: url,
  },
  shell: false,
});
process.exit(r.status ?? 1);
