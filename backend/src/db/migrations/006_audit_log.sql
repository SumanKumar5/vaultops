CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  project_id UUID,
  actor_type VARCHAR(20) NOT NULL,
  actor_id UUID,
  actor_ip INET,
  event_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  resource_type VARCHAR(30),
  metadata JSONB NOT NULL DEFAULT '[]',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chain_hash VARCHAR(64) NOT NULL
);