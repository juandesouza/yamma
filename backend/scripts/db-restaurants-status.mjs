/**
 * Connects with DATABASE_URL, prints restaurant stats, and tags seeded demo rows
 * with " [FAKE]" in the name (idempotent).
 */
import dotenv from 'dotenv';
import { Client } from 'pg';
import { printDbConnectionHints, pgSslForUrl } from './db-errors.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, override: true });

const SUFFIX = ' [FAKE]';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is missing');

  const client = new Client({ connectionString: dbUrl, ssl: pgSslForUrl(dbUrl) });
  await client.connect();

  const total = await client.query(`select count(*)::int as n from restaurants`);
  const withFake = await client.query(
    `select count(*)::int as n from restaurants where name like '%' || $1`,
    [SUFFIX]
  );
  const pexels = await client.query(
    `select count(*)::int as n from restaurants where image_url ilike '%pexels.com%'`
  );
  const demoOwners = await client.query(
    `select count(*)::int as n
     from restaurants r
     where r.owner_id in (select id from users where email like 'seller%@yamma.demo')`
  );

  console.log('Restaurant snapshot:');
  console.log(`  Total rows:              ${total.rows[0].n}`);
  console.log(`  Names ending with [FAKE]: ${withFake.rows[0].n}`);
  console.log(`  Pexels image_url:         ${pexels.rows[0].n}`);
  console.log(`  Owned by seller*@yamma.demo: ${demoOwners.rows[0].n}`);

  const cuisineSample = await client.query(
    `select cuisine, count(*)::int as n
     from restaurants
     group by cuisine
     order by n desc, cuisine
     limit 12`
  );
  if (cuisineSample.rows.length) {
    console.log('  Top cuisines (up to 12):');
    for (const row of cuisineSample.rows) {
      console.log(`    ${row.cuisine ?? '(null)'}: ${row.n}`);
    }
  }

  console.log('\nTagging demo rows with suffix if missing…');
  const tag = await client.query(
    `update restaurants r
     set name = r.name || $1
     where r.name not like '%' || $1
       and (
         r.image_url ilike '%pexels.com%'
         or r.owner_id in (select id from users where email like 'seller%@yamma.demo')
       )`,
    [SUFFIX]
  );
  console.log(`  Rows updated: ${tag.rowCount ?? 0}`);

  const after = await client.query(
    `select count(*)::int as n from restaurants where name like '%' || $1`,
    [SUFFIX]
  );
  console.log(`  Names with [FAKE] now: ${after.rows[0].n}`);

  await client.end();
}

main().catch((err) => {
  if (!printDbConnectionHints(err, process.env.DATABASE_URL)) {
    console.error(err);
  }
  process.exit(1);
});
