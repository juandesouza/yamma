-- Legacy databases may omit `currency` while the app inserts it on Lemon checkout.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD';

UPDATE "payments" SET "currency" = 'USD' WHERE "currency" IS NULL OR btrim("currency") = '';

ALTER TABLE "payments" ALTER COLUMN "currency" SET NOT NULL;
