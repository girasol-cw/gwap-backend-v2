-- Multi-tenant: add company_id to all tenant-scoped tables.
-- Run only on existing DBs that were created before company_id existed.
-- For existing rows you must backfill company_id (e.g. with a default tenant) before adding NOT NULL.

-- 1) Add nullable first so existing rows are valid
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id TEXT NULL;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS company_id TEXT NULL;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS company_id TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id TEXT NULL;

-- 2) Backfill: set a default tenant for existing data (change 'default-tenant' to your real company id if needed)
-- UPDATE users SET company_id = 'default-tenant' WHERE company_id IS NULL;
-- UPDATE wallets w SET company_id = (SELECT u.company_id FROM users u WHERE u.user_id = w.user_id);
-- UPDATE deposits d SET company_id = (SELECT u.company_id FROM users u WHERE u.user_id = d.user_id);
-- UPDATE orders o SET company_id = (SELECT u.company_id FROM users u WHERE u.user_id = o.user_id);

-- 3) Enforce NOT NULL after backfill
-- ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE wallets ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE deposits ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE orders ALTER COLUMN company_id SET NOT NULL;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_wallets_company_id ON wallets (company_id);
CREATE INDEX IF NOT EXISTS idx_deposits_company_id ON deposits (company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders (company_id);
