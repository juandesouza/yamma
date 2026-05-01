-- Align legacy databases where `CREATE TABLE IF NOT EXISTS` skipped newer columns on `users`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "crypto_payout_percent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "crypto_balance" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fiat_balance" numeric(12, 2) DEFAULT '0' NOT NULL;
