CREATE TABLE IF NOT EXISTS secret_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  principal_type VARCHAR(20) NOT NULL,
  principal_id UUID NOT NULL,
  environments TEXT[] NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT TRUE,
  can_write BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_policies BOOLEAN NOT NULL DEFAULT FALSE,
  key_pattern VARCHAR(255),
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);