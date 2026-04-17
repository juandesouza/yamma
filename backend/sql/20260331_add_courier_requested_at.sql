-- Run against your Yamma DB if the column is missing (Drizzle push may add it automatically).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_requested_at TIMESTAMPTZ;
