-- On-ramp intents (Transak / MoonPay / Ramp). Run if Drizzle push does not apply enums.
ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'transak';
ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'moonpay';
ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'ramp';

CREATE TABLE IF NOT EXISTS onramp_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  intent_kind text NOT NULL,
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  fiat_amount numeric(12, 2) NOT NULL,
  fiat_currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onramp_intents_user_idx ON onramp_intents (user_id);
CREATE INDEX IF NOT EXISTS onramp_intents_order_idx ON onramp_intents (order_id);
CREATE INDEX IF NOT EXISTS onramp_intents_status_idx ON onramp_intents (status);
