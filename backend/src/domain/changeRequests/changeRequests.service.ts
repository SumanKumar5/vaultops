import { pool } from "../../db/client";
import { decrypt, encrypt } from "../../crypto/envelopeEncryption";
import { writeAuditLog } from "../audit/auditLogger";
import { secretCache } from "../../services/secretCache";
import { Principal } from "../authz/policyEngine";

async function getOrgId(projectId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT org_id FROM projects WHERE id = $1`,
    [projectId],
  );
  if (rows.length === 0)
    throw Object.assign(new Error("Project not found"), { status: 404 });
  return rows[0].org_id;
}

export async function listChangeRequests(projectId: string, status?: string) {
  const conditions = ["project_id = $1"];
  const params: unknown[] = [projectId];

  if (status) {
    conditions.push(`status = $2`);
    params.push(status);
  }

  const { rows } = await pool.query(
    `SELECT cr.*, u.email AS requester_email
     FROM change_requests cr
     LEFT JOIN users u ON u.id = cr.requested_by
     WHERE ${conditions.join(" AND ")}
     ORDER BY cr.created_at DESC`,
    params,
  );
  return rows;
}

export async function approveChangeRequest(
  projectId: string,
  requestId: string,
  principal: Principal,
  actorIp: string | undefined,
) {
  const orgId = await getOrgId(projectId);

  const { rows } = await pool.query(
    `SELECT * FROM change_requests WHERE id = $1 AND project_id = $2`,
    [requestId, projectId],
  );

  if (rows.length === 0)
    throw Object.assign(new Error("Change request not found"), { status: 404 });

  const cr = rows[0];

  if (cr.status !== "pending") {
    throw Object.assign(
      new Error(`Cannot approve a request with status '${cr.status}'`),
      { status: 409 },
    );
  }

  if (cr.requested_by === principal.id) {
    throw Object.assign(
      new Error("You cannot approve your own change request"),
      { status: 403 },
    );
  }

  if (new Date(cr.expires_at) < new Date()) {
    throw Object.assign(new Error("Change request has expired"), {
      status: 410,
    });
  }

  for (const change of cr.changes) {
    const { key_name, new_encrypted_value, tags, expires_at } = change;

    await pool.query(
      `UPDATE secrets SET is_current = FALSE
       WHERE project_id = $1 AND environment = $2 AND key_name = $3 AND is_current = TRUE`,
      [projectId, cr.environment, key_name],
    );

    const nextVersion = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM secrets WHERE project_id = $1 AND environment = $2 AND key_name = $3`,
      [projectId, cr.environment, key_name],
    );

    await pool.query(
      `INSERT INTO secrets
        (project_id, environment, key_name, encrypted_value, encrypted_data_key,
         kms_key_id, version, is_current, created_by, expires_at, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)`,
      [
        projectId,
        cr.environment,
        key_name,
        new_encrypted_value.encrypted_value,
        new_encrypted_value.encrypted_data_key,
        new_encrypted_value.kms_key_id,
        nextVersion.rows[0].next_version,
        principal.id,
        expires_at ?? null,
        JSON.stringify(tags ?? []),
      ],
    );

    await secretCache.invalidate(projectId, cr.environment, key_name);
  }

  const { rows: updated } = await pool.query(
    `UPDATE change_requests
     SET status = 'applied', reviewed_by = $1, reviewed_at = NOW(), applied_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [principal.id, requestId],
  );

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "APPROVAL_GRANTED",
    resource_id: requestId,
    resource_type: "change_request",
    metadata: { environment: cr.environment },
  });

  return updated[0];
}

export async function rejectChangeRequest(
  projectId: string,
  requestId: string,
  reviewNote: string,
  principal: Principal,
  actorIp: string | undefined,
) {
  const orgId = await getOrgId(projectId);

  const { rows } = await pool.query(
    `SELECT * FROM change_requests WHERE id = $1 AND project_id = $2`,
    [requestId, projectId],
  );

  if (rows.length === 0)
    throw Object.assign(new Error("Change request not found"), { status: 404 });

  const cr = rows[0];

  if (cr.status !== "pending") {
    throw Object.assign(
      new Error(`Cannot reject a request with status '${cr.status}'`),
      { status: 409 },
    );
  }

  if (!reviewNote?.trim()) {
    throw Object.assign(new Error("review_note is required when rejecting"), {
      status: 400,
    });
  }

  const { rows: updated } = await pool.query(
    `UPDATE change_requests
     SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
     WHERE id = $3
     RETURNING *`,
    [principal.id, reviewNote, requestId],
  );

  await writeAuditLog({
    org_id: orgId,
    project_id: projectId,
    actor_type: principal.type,
    actor_id: principal.id,
    actor_ip: actorIp,
    event_type: "APPROVAL_DENIED",
    resource_id: requestId,
    resource_type: "change_request",
    metadata: { environment: cr.environment, review_note: reviewNote },
  });

  return updated[0];
}

export async function expireStaleRequests() {
  const { rows } = await pool.query(
    `UPDATE change_requests
     SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()
     RETURNING id, project_id`,
  );
  if (rows.length > 0) {
    console.log(`Expired ${rows.length} stale change request(s)`);
  }
}
