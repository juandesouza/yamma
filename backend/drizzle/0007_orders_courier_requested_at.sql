-- Legacy databases may omit this column while Drizzle selects it on INSERT ... RETURNING.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_requested_at" timestamp with time zone;
