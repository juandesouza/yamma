-- Legacy DBs created with CREATE TABLE IF NOT EXISTS may lack columns added later on `orders`.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "user_id" uuid;

DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
   ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_column THEN null;
 WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
 EXECUTE 'CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "orders" USING btree ("user_id")';
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_column THEN null;
 WHEN undefined_table THEN null;
END $$;
