CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  is_ci_token BOOLEAN NOT NULL DEFAULT FALSE,
  scoped_projects UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);