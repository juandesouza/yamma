-- Some production DBs use `customer_id` (NOT NULL) while the app inserts `user_id`.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid;

UPDATE "orders" SET "customer_id" = "user_id" WHERE "customer_id" IS NULL AND "user_id" IS NOT NULL;
UPDATE "orders" SET "user_id" = "customer_id" WHERE "user_id" IS NULL AND "customer_id" IS NOT NULL;

DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk"
   FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id")
   ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN invalid_table_definition THEN null;
END $$;

CREATE OR REPLACE FUNCTION orders_sync_customer_user_ids() RETURNS trigger AS $$
BEGIN
  IF NEW.customer_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.customer_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    NEW.user_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_sync_customer_user_ids_trg ON "orders";

CREATE TRIGGER orders_sync_customer_user_ids_trg
  BEFORE INSERT OR UPDATE OF user_id, customer_id ON "orders"
  FOR EACH ROW
  EXECUTE PROCEDURE orders_sync_customer_user_ids();
