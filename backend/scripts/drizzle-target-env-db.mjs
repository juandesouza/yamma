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
  console.error('Add your nHost Postgres URL to backend/.env, then retry: pnpm run db:migrate:env');
  process.exit(1);
}

function redactedDbTarget(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname + (parsed.port ? `:${parsed.port}` : '');
    const db = parsed.pathname.replace(/^\//, '') || '(default)';
    return `${host}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/drizzle-target-env-db.mjs <migrate|push|studio|generate> [...]');
  process.exit(1);
}

console.log(`[db:${cmd}:env] target ${redactedDbTarget(url)} (from backend/.env only, ignores .env.local)`);

if (cmd === 'migrate') {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[db:migrate:env] cannot connect to Postgres: ${msg}`);
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      console.error('Hint: wake nHost (Database → running), copy a fresh connection string into backend/.env and Render DATABASE_URL.');
    }
    process.exit(1);
  }
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
if ((r.status ?? 1) !== 0) {
  console.error(`[db:${cmd}:env] drizzle-kit ${cmd} failed (exit ${r.status ?? 1}). See errors above — npm only shows a generic lifecycle failure.`);
}
process.exit(r.status ?? 1);
