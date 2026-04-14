import { pool } from "../../db/client";
import { encrypt, decrypt } from "../../crypto/envelopeEncryption";
import { writeAuditLog } from "../audit/auditLogger";
import { secretCache } from "../../services/secretCache";
import { Principal } from "../authz/policyEngine";

export interface SecretMetadata {
  id: string;
  project_id: string;
  environment: string;
  key_name: string;
  version: number;
  is_current: boolean;
  created_by: string;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  tags: string[];
}

export interface SecretWithValue extends SecretMetadata {
  value: string;
}

async function getOrgId(projectId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT org_id FROM projects WHERE id = $1`,
    [projectId],
  );
  if (rows.length === 0) throw new Error("Project not found");
  return rows[0].org_id;
}

async function requiresApproval(
  projectId: string,
  environment: string,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT require_approval_for FROM projects WHERE id = $1`,
    [projectId],
  );
  if (rows.length === 0) throw new Error("Project not found");
  return rows[0].require_approval_for.includes(environment);
}

export async function listSecrets(
  projectId: string,
  environment: string,
  search?: string,
  tags?: string,
  showExpired = false,
): Promise<SecretMetadata[]> {
  const conditions = [
    "project_id = $1",
    "environment = $2",
    "is_current = TRUE",
  ];
  const params: unknown[] = [projectId, environment];
  let idx = 3;

  if (!showExpired) {
    conditions.push(`(expires_at IS NULL OR expires_at > NOW())`);
  }
  if (search) {
    conditions.push(`key_name ILIKE $${idx++}`);
    params.push(`%${search}%`);
  }
  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim());
    conditions.push(`tags ?| $${idx++}::text[]`);
    params.push(tagList);
  }

  const { rows } = await pool.query(
    `SELECT id, project_id, environment, key_name, version, is_current,
            created_by, created_at, rotated_at, expires_at, tags
     FROM secrets
     WHERE ${conditions.join(" AND ")}
     ORDER BY key_name ASC`,
    params,
  );
  return rows;
}

export async function getSecret(
  projectId: string,
  keyName: string,
  environment: string,
  version: number | undefined,
  principal: Principal,
  actorIp: string | undefined,
): Promise<SecretWithValue> {
  const orgId = await getOrgId(projectId);

  const cached =
    version === undefined
      ? await secretCache.get(projectId, environment, keyName)
      : null;

  if (cached !== null) {
    const { rows } = await pool.query(
      `SELECT id, project_id, environment, key_name, version, is_current,
              created_by, created_at, rotated_at, expires_at, tags
       FROM secrets
       WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND is_current = TRUE`,
      [projectId, environment, keyName],
    );
    if (rows.length > 0) {
      await writeAuditLog({
        org_id: orgId,
        project_id: projectId,
        actor_type: principal.type,
        actor_id: principal.id,
        actor_ip: actorIp,
        event_type: "SECRET_READ",
        resource_id: rows[0].id,
        resource_type: "secret",
        metadata: { key_name: keyName, environment, cache_hit: true },
      });
      return { ...rows[0], value: cached };
    }
  }

  const versionCondition =
    version !== undefined ? "version = $4" : "is_current = TRUE";

  const queryParams: unknown[] = [projectId, environment, keyName];
  if (version !== undefined) queryParams.push(version);

  const { rows } = await pool.query(
    `SELECT id, project_id, environment, key_name, version, is_current,
            created_by, created_at, rotated_at, expires_at, tags,
            encrypted_value, encrypted_data_key, kms_key_id
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND key_name = $3
       AND ${versionCondition}`,
    queryParams,
  );

  if (rows.length === 0)
    throw Object.assign(new Error("Secret not found"), { status: 404 });

  const row = rows[0];
  const value = await decrypt({
    encrypted_value: row.encrypted_value,
    encrypted_data_key: row.encrypted_data_key,
    kms_key_id: row.kms_key_id,
  });

  if (version === undefined) {
    await secretCache.set(projectId, environment, keyName, value);
  }

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "SECRET_READ",
    resource_id: row.id,
    resource_type: "secret",
    metadata: { key_name: keyName, environment, version: row.version },
  });

  return { ...row, value };
}

export async function writeSecret(
  projectId: string,
  keyName: string,
  environment: string,
  value: string,
  tags: string[],
  expiresAt: string | undefined,
  principal: Principal,
  actorIp: string | undefined,
): Promise<{
  secret?: SecretMetadata;
  changeRequest?: Record<string, unknown>;
  requiresApproval: boolean;
}> {
  const orgId = await getOrgId(projectId);
  const needsApproval = await requiresApproval(projectId, environment);

  if (needsApproval) {
    const encrypted = await encrypt(value);
    const { rows } = await pool.query(
      `INSERT INTO change_requests (project_id, environment, requested_by, changes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        projectId,
        environment,
        principal.id,
        JSON.stringify([
          {
            key_name: keyName,
            new_encrypted_value: encrypted,
            tags,
            expires_at: expiresAt,
          },
        ]),
      ],
    );
    await writeAuditLog({
      org_id: orgId,
      project_id: projectId,
      actor_type: principal.type,
      actor_id: principal.id,
      actor_ip: actorIp,
      event_type: "APPROVAL_REQUESTED",
      resource_id: rows[0].id,
      resource_type: "change_request",
      metadata: { key_name: keyName, environment },
    });
    return { changeRequest: rows[0], requiresApproval: true };
  }

  const encrypted = await encrypt(value);

  await pool.query(
    `UPDATE secrets SET is_current = FALSE
     WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND is_current = TRUE`,
    [projectId, environment, keyName],
  );

  const nextVersion = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND key_name = $3`,
    [projectId, environment, keyName],
  );

  const { rows } = await pool.query(
    `INSERT INTO secrets
      (project_id, environment, key_name, encrypted_value, encrypted_data_key,
       kms_key_id, version, is_current, created_by, expires_at, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)
     RETURNING id, project_id, environment, key_name, version, is_current,
               created_by, created_at, rotated_at, expires_at, tags`,
    [
      projectId,
      environment,
      keyName,
      encrypted.encrypted_value,
      encrypted.encrypted_data_key,
      encrypted.kms_key_id,
      nextVersion.rows[0].next_version,
      principal.id,
      expiresAt ?? null,
      JSON.stringify(tags),
    ],
  );

  await secretCache.invalidate(projectId, environment, keyName);

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "SECRET_WRITTEN",
    resource_id: rows[0].id,
    resource_type: "secret",
    metadata: { key_name: keyName, environment, version: rows[0].version },
  });

  return { secret: rows[0], requiresApproval: false };
}

export async function deleteSecret(
  projectId: string,
  keyName: string,
  environment: string,
  principal: Principal,
  actorIp: string | undefined,
): Promise<void> {
  const orgId = await getOrgId(projectId);

  const { rows } = await pool.query(
    `UPDATE secrets SET is_current = FALSE
     WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND is_current = TRUE
     RETURNING id`,
    [projectId, environment, keyName],
  );

  if (rows.length === 0)
    throw Object.assign(new Error("Secret not found"), { status: 404 });

  await secretCache.invalidate(projectId, environment, keyName);

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "SECRET_DELETED",
    resource_id: rows[0].id,
    resource_type: "secret",
    metadata: { key_name: keyName, environment },
  });
}

export async function getSecretHistory(
  projectId: string,
  keyName: string,
  environment: string,
): Promise<SecretMetadata[]> {
  const { rows } = await pool.query(
    `SELECT id, project_id, environment, key_name, version, is_current,
            created_by, created_at, rotated_at, expires_at, tags
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND key_name = $3
     ORDER BY version DESC`,
    [projectId, environment, keyName],
  );
  return rows;
}

export async function rollbackSecret(
  projectId: string,
  keyName: string,
  environment: string,
  targetVersion: number,
  principal: Principal,
  actorIp: string | undefined,
): Promise<SecretMetadata> {
  const orgId = await getOrgId(projectId);

  const { rows: target } = await pool.query(
    `SELECT encrypted_value, encrypted_data_key, kms_key_id, tags, expires_at
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND version = $4`,
    [projectId, environment, keyName, targetVersion],
  );

  if (target.length === 0) {
    throw Object.assign(new Error(`Version ${targetVersion} not found`), {
      status: 404,
    });
  }

  await pool.query(
    `UPDATE secrets SET is_current = FALSE
     WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND is_current = TRUE`,
    [projectId, environment, keyName],
  );

  const nextVersion = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND key_name = $3`,
    [projectId, environment, keyName],
  );

  const { rows } = await pool.query(
    `INSERT INTO secrets
      (project_id, environment, key_name, encrypted_value, encrypted_data_key,
       kms_key_id, version, is_current, created_by, tags, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)
     RETURNING id, project_id, environment, key_name, version, is_current,
               created_by, created_at, rotated_at, expires_at, tags`,
    [
      projectId,
      environment,
      keyName,
      target[0].encrypted_value,
      target[0].encrypted_data_key,
      target[0].kms_key_id,
      nextVersion.rows[0].next_version,
      principal.id,
      target[0].tags,
      target[0].expires_at,
    ],
  );

  await secretCache.invalidate(projectId, environment, keyName);

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "ROLLBACK",
    resource_id: rows[0].id,
    resource_type: "secret",
    metadata: {
      key_name: keyName,
      environment,
      target_version: targetVersion,
      new_version: rows[0].version,
    },
  });

  return rows[0];
}

export async function bulkExport(
  projectId: string,
  environment: string,
  format: "env" | "json" | "yaml",
  principal: Principal,
  actorIp: string | undefined,
): Promise<string> {
  const orgId = await getOrgId(projectId);

  const { rows } = await pool.query(
    `SELECT key_name, encrypted_value, encrypted_data_key, kms_key_id
     FROM secrets
     WHERE project_id = $1 AND environment = $2 AND is_current = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [projectId, environment],
  );

  const decrypted: Record<string, string> = {};
  for (const row of rows) {
    decrypted[row.key_name] = await decrypt({
      encrypted_value: row.encrypted_value,
      encrypted_data_key: row.encrypted_data_key,
      kms_key_id: row.kms_key_id,
    });
  }

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "BULK_EXPORT",
    resource_type: "project",
    metadata: { environment, format, count: rows.length },
  });

  if (format === "json") return JSON.stringify(decrypted, null, 2);
  if (format === "env")
    return Object.entries(decrypted)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

  return Object.entries(decrypted)
    .map(([k, v]) => `${k}: "${v.replace(/"/g, '\\"')}"`)
    .join("\n");
}
