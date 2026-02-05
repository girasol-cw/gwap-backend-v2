-- users (company_id: multi-tenant isolation)
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  girasol_account_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status text null,
  label text null,
  first_name text NOT NULL,
  middle_name text null,
  last_name TEXT NOT NULL,
  date_of_birth date NOT NULL,
  national_id_country text NOT NULL,
  national_id_type text NOT NULL,
  national_id text NOT NULL,
  citizenship text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text null,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL,
  zip_code text NOT NULL,
  tax_id text NULL,
  tax_country text NULL,
  cellphone text NOT NULL,
  email TEXT NOT NULL,
  customer JSONB Null
);

-- wallets
CREATE TABLE wallets (
  id TEXT NOT NULL PRIMARY KEY,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  deposit_addr TEXT NOT NULL,
  network TEXT NOT NULL,
  currency TEXT NULL,
  asset_type TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE deposits (
  order_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  erc20_amount TEXT NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE, 
  amount_usd TEXT NOT NULL,
  PRIMARY KEY (order_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE requests (
  id TEXT NOT NULL,
  verb TEXT NOT NULL,
  path TEXT NOT NULL,
  body JSONB  NULL,
  response_body JSONB  NULL,
  error JSONB null,
  status_code TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
)

CREATE TABLE orders (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  asset JSONB NOT NULL,
  settlement JSONB Null,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_body JSONB Null,
  order_response JSONB Null,
  network TEXT NULL,
  fees text null,
  destination_type text null,
  destination_value text null,
  destination_amount text null,
  requires_confirmation_code BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_company_id ON wallets (company_id);
CREATE INDEX IF NOT EXISTS idx_wallets_network ON wallets (network);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_company_id ON deposits (company_id);
CREATE INDEX IF NOT EXISTS idx_deposits_confirmed ON deposits (confirmed);

CREATE INDEX IF NOT EXISTS idx_deposits_unconfirmed_partial
  ON deposits (order_id) WHERE confirmed = false;

CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders (company_id);
CREATE INDEX IF NOT EXISTS idx_requests_status_code ON requests (status_code);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);

ALTER TABLE deposits ADD COLUMN currency TEXT NULL;
alter table users add column auto_sale BOOLEAN DEFAULT TRUE;