/**
 * Rewrites image_url for all restaurants using stable Unsplash URLs by cuisine.
 * Run after fixing food-image-urls.mjs or when old Pexels URLs 404.
 */
import dotenv from 'dotenv';
import { Client } from 'pg';
import { printDbConnectionHints, pgSslForUrl } from './db-errors.mjs';
import { IMAGE_BY_CUISINE, DEFAULT_FOOD_IMAGES } from './food-image-urls.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, override: true });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is missing');

async function main() {
  const client = new Client({ connectionString: dbUrl, ssl: pgSslForUrl(dbUrl) });
  await client.connect();

  const { rows } = await client.query(`select id, cuisine from restaurants`);
  let n = 0;
  for (const row of rows) {
    const cuisine = row.cuisine ?? 'Pizza';
    const pool = IMAGE_BY_CUISINE[cuisine] ?? DEFAULT_FOOD_IMAGES;
    const imageUrl = pool[0];
    await client.query(`update restaurants set image_url = $1 where id = $2`, [imageUrl, row.id]);
    n += 1;
  }

  console.log(`Updated image_url for ${n} restaurant(s) using Unsplash CDN map.`);
  await client.end();
}

main().catch((err) => {
  if (!printDbConnectionHints(err, process.env.DATABASE_URL)) console.error(err);
  process.exit(1);
});
