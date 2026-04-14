CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  environment VARCHAR(50) NOT NULL,
  key_name VARCHAR(255) NOT NULL,
  encrypted_value TEXT NOT NULL,
  encrypted_data_key TEXT NOT NULL,
  kms_key_id VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  tags JSONB NOT NULL DEFAULT '[]',
  UNIQUE(project_id, environment, key_name, version)
);