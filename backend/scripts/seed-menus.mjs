import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { printDbConnectionHints, pgSslForUrl } from './db-errors.mjs';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
  dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, override: true });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is missing');
}

/** Keep small — hosted Postgres / poolers drop long-lived single connections */
const BATCH_SIZE = 10;
const PAUSE_MS = 600;
/** Stop after repeated connection or batch errors (avoid infinite retries) */
const MAX_FAIL_STREAK = 15;

/** @param {string | null | undefined} cuisine */
function dishRows(cuisine) {
  const c = (cuisine ?? '').toLowerCase();
  if (c.includes('pizza')) {
    return [
      ['Margherita', 'Tomato, mozzarella, basil', '11.99'],
      ['Pepperoni', 'Classic pepperoni', '13.99'],
      ['Veggie', 'Seasonal vegetables', '12.49'],
      ['BBQ Chicken', 'BBQ sauce & chicken', '14.99'],
    ];
  }
  if (c.includes('sushi') || c.includes('ramen')) {
    return [
      ['Chef combo', 'Mixed chef selection', '16.99'],
      ['House bowl', 'Signature bowl', '14.49'],
      ['Side miso', 'Miso soup', '3.99'],
      ['Green tea dessert', 'Light finish', '5.99'],
    ];
  }
  if (c.includes('burger')) {
    return [
      ['Classic burger', 'Beef, lettuce, tomato', '10.99'],
      ['Double stack', 'Two patties', '13.99'],
      ['Crispy fries', 'Large', '4.49'],
      ['Shake', 'Vanilla or chocolate', '5.99'],
    ];
  }
  return [
    ['House favorite', 'Chef’s daily pick', '12.99'],
    ['Signature plate', 'Popular choice', '15.99'],
    ['Combo meal', 'Main + side', '18.99'],
    ['Side or add-on', 'Perfect extra', '5.49'],
  ];
}

function makeClient() {
  const ssl = pgSslForUrl(dbUrl);
  const c = new Client({
    connectionString: dbUrl,
    ssl,
    keepAlive: true,
    keepAliveInitialDelayMillis: 4000,
    connectionTimeoutMillis: 90_000,
    /** Reduces pooled connection surprises on cloud providers */
    application_name: 'yamma_seed_menus',
  });
  c.on('error', (err) => {
    console.warn(`[seed-menus] client error event: ${err?.message ?? err}`);
  });
  return c;
}

async function safeEnd(client) {
  try {
    await client.end();
  } catch {
    /* socket may already be gone */
  }
}

/**
 * @param {import('pg').Client} client
 * @param {string} menuId
 * @param {Array<[string, string, string]>} dishes
 */
async function insertMenuItemsBatch(client, menuId, dishes) {
  if (dishes.length === 0) return;
  const fragments = [];
  const vals = [];
  let p = 1;
  for (let sort = 0; sort < dishes.length; sort += 1) {
    const [name, description, price] = dishes[sort];
    fragments.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, true)`);
    vals.push(randomUUID(), menuId, name, description, price, sort);
  }
  await client.query(
    `insert into menu_items (id, menu_id, name, description, price, sort_order, available)
     values ${fragments.join(', ')}`,
    vals
  );
}

/**
 * @param {import('pg').Client} client
 * @param {{ id: string, cuisine?: string }} row
 */
async function seedOneRestaurant(client, row) {
  const menuId = randomUUID();
  await client.query(
    `insert into menus (id, restaurant_id, name, sort_order)
     values ($1, $2, $3, 0)`,
    [menuId, row.id, 'Menu']
  );
  await insertMenuItemsBatch(client, menuId, dishRows(row.cuisine));
}

async function fetchBatch(client, limit) {
  const { rows } = await client.query(
    `select r.id, r.cuisine
     from restaurants r
     where not exists (select 1 from menus m where m.restaurant_id = r.id)
     order by r.id
     limit $1`,
    [limit]
  );
  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(
    `Seeding menus in batches (up to ${BATCH_SIZE} restaurants per transaction). Resumable if the connection drops.`
  );

  let batchIndex = 0;
  let totalSeeded = 0;
  let failStreak = 0;

  while (true) {
    const client = makeClient();
    try {
      await client.connect();
    } catch (err) {
      await safeEnd(client);
      failStreak += 1;
      console.error(`[seed-menus] connect failed (${failStreak}/${MAX_FAIL_STREAK}): ${err?.message ?? err}`);
      if (failStreak >= MAX_FAIL_STREAK) {
        console.error('Giving up.');
        process.exit(1);
      }
      await sleep(PAUSE_MS + failStreak * 250);
      continue;
    }

    let rows = [];
    try {
      rows = await fetchBatch(client, BATCH_SIZE);
      if (rows.length === 0) {
        await safeEnd(client);
        break;
      }
      batchIndex += 1;
      console.log(`Batch ${batchIndex}: ${rows.length} restaurant(s) need menus…`);
      await client.query('BEGIN');
      for (const row of rows) {
        await seedOneRestaurant(client, row);
      }
      await client.query('COMMIT');
      totalSeeded += rows.length;
      failStreak = 0;
      console.log(`  OK — ${totalSeeded} restaurant(s) with menus total so far.`);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      failStreak += 1;
      console.error(`[seed-menus] batch failed (${failStreak}/${MAX_FAIL_STREAK}): ${err?.message ?? err}`);
      if (failStreak >= MAX_FAIL_STREAK) {
        console.error('Giving up.');
        await safeEnd(client);
        process.exit(1);
      }
    } finally {
      await safeEnd(client);
      await sleep(PAUSE_MS);
    }
  }

  if (totalSeeded === 0) {
    console.log('No restaurants without menus — nothing to seed.');
    return;
  }

  console.log(`Summary (${totalSeeded} restaurant menus added this run).`);
  const client = makeClient();
  await client.connect();
  try {
    const { rows: counts } = await client.query(`select count(*)::int as menus from menus`);
    const { rows: itemCounts } = await client.query(`select count(*)::int as items from menu_items`);
    console.log(`Done. menus=${counts[0].menus}, menu_items=${itemCounts[0].items}`);
  } finally {
    await safeEnd(client);
  }
}

main().catch((err) => {
  if (!printDbConnectionHints(err, process.env.DATABASE_URL)) {
    console.error(err);
  }
  process.exit(1);
});
