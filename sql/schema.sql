-- users
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  girasol_account_id TEXT NOT NULL,
  email TEXT NOT NULL
);

-- wallets
CREATE TABLE wallets (
  user_id TEXT NOT NULL,
  deposit_addr TEXT NOT NULL,
  network TEXT NOT NULL,
  currency TEXT NOT NULL,
  asset_type TEXT NOT NULL,

  PRIMARY KEY (deposit_addr, network),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- deposits
CREATE TABLE deposits (
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  deposit_addr TEXT NOT NULL,
  erc20_amount TEXT NOT NULL,
  network TEXT NOT NULL,
  settled BOOLEAN DEFAULT FALSE, 
  amount_usd TEXT NOT NULL,
  PRIMARY KEY (order_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (deposit_addr) REFERENCES wallets(deposit_addr) ON DELETE CASCADE
);

CREATE TABLE requests (
  id TEXT NOT NULL,
  verb TEXT NOT NULL,
  path TEXT NOT NULL,
  body TEXT  NULL,
  response_body TEXT  NULL,
  error text null,
  status_code TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
)


CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_network ON wallets (network);


CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_addr_net ON deposits (deposit_addr, network);
CREATE INDEX IF NOT EXISTS idx_deposits_confirmed ON deposits (confirmed);

CREATE INDEX IF NOT EXISTS idx_deposits_unconfirmed_partial
  ON deposits (order_id) WHERE confirmed = false;


CREATE INDEX IF NOT EXISTS idx_requests_status_code ON requests (status_code);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
