-- Legacy/production databases may require split address columns and is_active on restaurants.
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "address_street" text;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "address_city" text;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "address_state" text;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "address_zip" text;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;

UPDATE "restaurants"
SET
  "address_street" = COALESCE(NULLIF(btrim("address_street"), ''), NULLIF(btrim(split_part("address", ',', 1)), ''), '—'),
  "address_city" = COALESCE(NULLIF(btrim("address_city"), ''), 'Unknown'),
  "address_state" = COALESCE(NULLIF(btrim("address_state"), ''), 'NA'),
  "address_zip" = COALESCE(NULLIF(btrim("address_zip"), ''), '00000'),
  "is_active" = COALESCE("is_active", true)
WHERE "address_street" IS NULL
   OR "address_city" IS NULL
   OR "address_state" IS NULL
   OR "address_zip" IS NULL
   OR "is_active" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants'
      AND column_name = 'address_street' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "restaurants" ALTER COLUMN "address_street" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants'
      AND column_name = 'address_city' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "restaurants" ALTER COLUMN "address_city" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants'
      AND column_name = 'address_state' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "restaurants" ALTER COLUMN "address_state" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants'
      AND column_name = 'address_zip' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "restaurants" ALTER COLUMN "address_zip" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants'
      AND column_name = 'is_active' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "restaurants" ALTER COLUMN "is_active" SET NOT NULL;
  END IF;
END $$;
