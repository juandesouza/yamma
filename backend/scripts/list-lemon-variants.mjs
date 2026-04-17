#!/usr/bin/env node
/**
 * Lists Lemon Squeezy variant IDs for products in a store (same IDs the Checkouts API expects).
 * Usage from repo root: pnpm run lemon:list-variants -w backend
 * Requires LEMON_SQUEEZE_API_KEY and LEMON_SQUEEZE_STORE_ID in backend/.env.local
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const API = 'https://api.lemonsqueezy.com/v1';
const key = process.env.LEMON_SQUEEZE_API_KEY;
const storeId = process.env.LEMON_SQUEEZE_STORE_ID?.replace(/^#/, '').trim();

if (!key) {
  console.error('Missing LEMON_SQUEEZE_API_KEY in backend/.env or .env.local');
  process.exit(1);
}
if (!storeId) {
  console.error('Missing LEMON_SQUEEZE_STORE_ID in backend/.env or .env.local');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  Accept: 'application/vnd.api+json',
};

async function main() {
  const url = new URL(`${API}/products`);
  url.searchParams.set('filter[store_id]', storeId);
  url.searchParams.set('page[size]', '50');

  const pres = await fetch(url, { headers });
  const ptext = await pres.text();
  if (!pres.ok) {
    console.error('List products failed', pres.status, ptext.slice(0, 500));
    process.exit(1);
  }
  const pj = JSON.parse(ptext);
  const products = pj.data ?? [];
  if (!products.length) {
    console.log(`No products for store_id=${storeId}. Check LEMON_SQUEEZE_STORE_ID (Settings → Stores).`);
    return;
  }

  console.log(`Store ${storeId} — variants to use as LEMON_SQUEEZE_VARIANT_ID:\n`);

  for (const p of products) {
    const pid = p.id;
    const name = p.attributes?.name ?? '(unnamed)';
    const vurl = new URL(`${API}/variants`);
    vurl.searchParams.set('filter[product_id]', String(pid));
    vurl.searchParams.set('page[size]', '20');
    const vres = await fetch(vurl, { headers });
    const vtext = await vres.text();
    if (!vres.ok) {
      console.error(`  Product ${pid} ${name}: variants fetch failed`, vres.status);
      continue;
    }
    const vj = JSON.parse(vtext);
    const variants = vj.data ?? [];
    console.log(`Product ${pid}: ${name}`);
    if (!variants.length) {
      console.log('  (no variants returned)');
      continue;
    }
    for (const v of variants) {
      const st = v.attributes?.status ?? '?';
      const tm = v.attributes?.test_mode === true ? 'test' : 'live';
      console.log(`  variant id=${v.id}  status=${st}  mode=${tm}  name=${v.attributes?.name ?? ''}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
