import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { printDbConnectionHints, pgSslForUrl } from './db-errors.mjs';
import { IMAGE_BY_CUISINE, DEFAULT_FOOD_IMAGES } from './food-image-urls.mjs';

// If DATABASE_URL is already set (e.g. seed-restaurants-env.mjs), never override via .env.local.
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
  dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, override: true });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is missing');
}

/** Appended to seeded demo rows so they are clearly not real venues */
const FAKE_NAME_SUFFIX = ' [FAKE]';

const cuisines = [
  'Pizza',
  'Burger',
  'Sushi',
  'Seafood',
  'BBQ',
  'Steakhouse',
  'Meat',
  'Mexican',
  'Italian',
  'Thai',
  'Indian',
  'Chinese',
  'Korean',
  'Ramen',
  'Chicken',
  'Breakfast',
  'Mediterranean',
  'Vegan',
  'Bakery',
  'Desserts',
];

const cities = [
  ['Miami', 'FL'],
  ['Orlando', 'FL'],
  ['Tampa', 'FL'],
  ['Atlanta', 'GA'],
  ['Charlotte', 'NC'],
  ['Raleigh', 'NC'],
  ['Nashville', 'TN'],
  ['Richmond', 'VA'],
  ['Washington', 'DC'],
  ['Baltimore', 'MD'],
  ['Philadelphia', 'PA'],
  ['Newark', 'NJ'],
  ['Jersey City', 'NJ'],
  ['New York', 'NY'],
  ['Boston', 'MA'],
  ['Providence', 'RI'],
  ['Hartford', 'CT'],
  ['Pittsburgh', 'PA'],
  ['Buffalo', 'NY'],
  ['Cleveland', 'OH'],
];

const wordsA = ['Golden', 'Urban', 'Sunset', 'Blue', 'Prime', 'Rustic', 'Crispy', 'Velvet', 'Fire', 'Ocean', 'Maple', 'Royal'];
const wordsB = ['Fork', 'Bite', 'Kitchen', 'Table', 'House', 'Grill', 'Spot', 'Market', 'Street', 'Corner', 'Hub', 'Garden'];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];
const randomEastUsLat = () => (24.8 + Math.random() * (45.1 - 24.8)).toFixed(7);
const randomEastUsLng = () => (-82.8 + Math.random() * (-66.8 + 82.8)).toFixed(7);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function restaurantName(cuisine, idx) {
  return `${pick(wordsA)} ${cuisine} ${pick(wordsB)} ${idx + 1}${FAKE_NAME_SUFFIX}`;
}

async function main() {
  console.log('Connecting to database…');
  const client = new Client({ connectionString: dbUrl, ssl: pgSslForUrl(dbUrl) });
  await client.connect();
  console.log('Connected. Inspecting restaurants table…');

  const { rows: restaurantColumns } = await client.query(
    `select column_name, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = 'restaurants'`
  );
  const restaurantColumnSet = new Set(restaurantColumns.map((r) => r.column_name));
  const requiredColumns = restaurantColumns
    .filter((r) => r.is_nullable === 'NO' && r.column_default === null)
    .map((r) => r.column_name);

  console.log('Creating/updating demo seller accounts (24)…');
  const ownerIds = [];
  for (let i = 0; i < 24; i += 1) {
    const desiredOwnerId = randomUUID();
    const upsertOwner = await client.query(
      `insert into users (id, email, name, role)
       values ($1, $2, $3, 'restaurant')
       on conflict (email) do update set role = 'restaurant'
       returning id`,
      [desiredOwnerId, `seller${i + 1}@yamma.demo`, `Seller ${i + 1}`]
    );
    ownerIds.push(upsertOwner.rows[0].id);
  }

  const totalRestaurants = 130;
  console.log(`Inserting ${totalRestaurants} restaurants (one round-trip each — can take ~30–90s on remote DB)…`);
  for (let i = 0; i < totalRestaurants; i += 1) {
    const cuisine = pick(cuisines);
    const name = restaurantName(cuisine, i);
    const [city, state] = pick(cities);
    const streetNumber = randomInt(100, 9999);
    const address = `${streetNumber} ${pick(['Main St', 'Broadway', 'Market St', 'Ocean Ave', 'Pine St', 'Maple Ave'])}, ${city}, ${state}`;
    const ownerId = pick(ownerIds);
    const imagePool = IMAGE_BY_CUISINE[cuisine] ?? DEFAULT_FOOD_IMAGES;
    const image = pick(imagePool);
    const slug = `${slugify(name)}-${randomInt(1000, 9999)}`;

    const lat = randomEastUsLat();
    const lng = randomEastUsLng();
    const valuesByColumn = {
      id: randomUUID(),
      owner_id: ownerId,
      name,
      slug,
      description: `${cuisine} favorites with fast delivery and fresh ingredients.`,
      image_url: image,
      cuisine,
      address,
      address_street: `${streetNumber} ${pick(['Main St', 'Broadway', 'Market St', 'Ocean Ave', 'Pine St', 'Maple Ave'])}`,
      address_city: city,
      address_state: state,
      address_zip: `${randomInt(10000, 99999)}`,
      latitude: lat,
      longitude: lng,
      is_open: true,
      is_active: true,
    };

    const columns = Object.keys(valuesByColumn).filter((column) => restaurantColumnSet.has(column));
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const values = columns.map((column) => valuesByColumn[column]);

    const missingRequired = requiredColumns.filter((column) => !columns.includes(column));
    if (missingRequired.length) {
      throw new Error(`Missing required restaurants columns in seed payload: ${missingRequired.join(', ')}`);
    }

    await client.query(
      `insert into restaurants (${columns.join(', ')})
       values (${placeholders.join(', ')})
       on conflict (slug) do nothing`,
      values
    );
    if ((i + 1) % 10 === 0 || i === totalRestaurants - 1) {
      console.log(`  … ${i + 1} / ${totalRestaurants}`);
    }
  }

  console.log('Summarizing…');
  const { rows } = await client.query(
    `select cuisine, count(*)::int as count
     from restaurants
     group by cuisine
     order by count desc, cuisine asc`
  );
  const { rows: countRows } = await client.query(`select count(*)::int as count from restaurants`);

  console.log(`Done. Restaurants total in DB now: ${countRows[0].count}`);
  console.table(rows);
  await client.end();
}

main().catch((err) => {
  if (!printDbConnectionHints(err, process.env.DATABASE_URL)) {
    console.error(err);
  }
  process.exit(1);
});
