ALTER TABLE deposits ADD COLUMN IF NOT EXISTS forward_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS forward_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMP NULL;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS forward_last_error TEXT NULL;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS forward_response JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_deposits_forward_status ON deposits (forward_status);
