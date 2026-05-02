-- Older Nhost / manual databases may lack `currency` while the app inserts it.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD';
