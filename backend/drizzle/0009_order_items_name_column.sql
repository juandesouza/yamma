-- Legacy `order_items` rows may omit `name` while the API snapshots item title at checkout.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "name" text;

UPDATE "order_items" oi
SET "name" = mi."name"
FROM "menu_items" mi
WHERE oi."menu_item_id" = mi."id"
  AND (
    oi."name" IS NULL
    OR btrim(oi."name") = ''
  );

UPDATE "order_items"
SET "name" = 'Unknown item'
WHERE "name" IS NULL OR btrim("name") = '';

ALTER TABLE "order_items" ALTER COLUMN "name" SET NOT NULL;
