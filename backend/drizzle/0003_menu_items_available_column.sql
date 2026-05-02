-- Align legacy databases missing menu_items.available.
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "available" boolean DEFAULT true NOT NULL;
