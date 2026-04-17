import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { printDbConnectionHints, pgSslForUrl } from './db-errors.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, override: true });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is missing');
}

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

async function main() {
  console.log('Connecting to database…');
  const client = new Client({ connectionString: dbUrl, ssl: pgSslForUrl(dbUrl) });
  await client.connect();

  const { rows: targets } = await client.query(
    `select r.id, r.cuisine
     from restaurants r
     where not exists (select 1 from menus m where m.restaurant_id = r.id)`
  );

  if (targets.length === 0) {
    console.log('No restaurants without menus — nothing to seed.');
    await client.end();
    return;
  }

  console.log(`Seeding one menu + items for ${targets.length} restaurant(s)…`);

  for (const row of targets) {
    const menuId = randomUUID();
    await client.query(
      `insert into menus (id, restaurant_id, name, sort_order)
       values ($1, $2, $3, 0)`,
      [menuId, row.id, 'Menu']
    );

    const dishes = dishRows(row.cuisine);
    let sort = 0;
    for (const [name, description, price] of dishes) {
      await client.query(
        `insert into menu_items (id, menu_id, name, description, price, sort_order, available)
         values ($1, $2, $3, $4, $5, $6, true)`,
        [randomUUID(), menuId, name, description, price, sort]
      );
      sort += 1;
    }
  }

  const { rows: counts } = await client.query(
    `select count(*)::int as menus from menus`
  );
  const { rows: itemCounts } = await client.query(
    `select count(*)::int as items from menu_items`
  );
  console.log(`Done. menus=${counts[0].menus}, menu_items=${itemCounts[0].items}`);
  await client.end();
}

main().catch((err) => {
  if (!printDbConnectionHints(err, process.env.DATABASE_URL)) {
    console.error(err);
  }
  process.exit(1);
});
