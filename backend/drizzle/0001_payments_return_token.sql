ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "return_token" text;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_return_token_uidx" ON "payments" ("return_token");
