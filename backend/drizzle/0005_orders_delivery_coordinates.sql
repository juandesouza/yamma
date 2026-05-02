-- Legacy orders table may omit coordinates added later in baseline schema.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_latitude" numeric(10, 7);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_longitude" numeric(10, 7);
