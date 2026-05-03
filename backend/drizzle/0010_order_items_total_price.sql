-- Some production DBs store denormalized `total_price` (NOT NULL) per line item.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);

UPDATE "order_items"
SET "total_price" = round(COALESCE("quantity", 0)::numeric * COALESCE("unit_price", 0)::numeric, 2)
WHERE "total_price" IS NULL;

ALTER TABLE "order_items" ALTER COLUMN "total_price" SET NOT NULL;

CREATE OR REPLACE FUNCTION order_items_fill_total_price() RETURNS trigger AS $$
BEGIN
  IF NEW."total_price" IS NULL THEN
    NEW."total_price" := round(COALESCE(NEW."quantity", 0)::numeric * COALESCE(NEW."unit_price", 0)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_items_fill_total_price_trg ON "order_items";

CREATE TRIGGER order_items_fill_total_price_trg
  BEFORE INSERT OR UPDATE OF "quantity", "unit_price", "total_price" ON "order_items"
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_fill_total_price();
