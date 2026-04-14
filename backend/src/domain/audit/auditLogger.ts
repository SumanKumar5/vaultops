import crypto from "crypto";
import { pool } from "../../db/client";

export type EventType =
  | "SECRET_READ"
  | "SECRET_WRITTEN"
  | "SECRET_DELETED"
  | "SECRET_ROTATED"
  | "POLICY_CHANGED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "BULK_EXPORT"
  | "ROLLBACK";

export interface AuditEntry {
  org_id: string;
  project_id?: string;
  actor_type: "user" | "service_account" | "ci_token" | "system";
  actor_id?: string;
  actor_ip?: string;
  event_type: EventType;
  resource_id?: string;
  resource_type?: string;
  metadata?: Record<string, unknown>;
}

const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

async function getLastChainHash(orgId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT chain_hash FROM audit_log
     WHERE org_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [orgId],
  );
  return rows.length > 0 ? rows[0].chain_hash : GENESIS_HASH;
}

function computeChainHash(
  prevHash: string,
  eventType: string,
  resourceId: string,
  occurredAt: string,
  actorId: string,
): string {
  const input = `${prevHash}${eventType}${resourceId}${occurredAt}${actorId}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const occurredAt = new Date().toISOString();
  const resourceId = entry.resource_id ?? "";
  const actorId = entry.actor_id ?? "";

  const prevHash = await getLastChainHash(entry.org_id);
  const chainHash = computeChainHash(
    prevHash,
    entry.event_type,
    resourceId,
    occurredAt,
    actorId,
  );

  await pool.query(
    `INSERT INTO audit_log
      (org_id, project_id, actor_type, actor_id, actor_ip,
       event_type, resource_id, resource_type, metadata, occurred_at, chain_hash)
     VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10,$11)`,
    [
      entry.org_id,
      entry.project_id ?? null,
      entry.actor_type,
      entry.actor_id ?? null,
      entry.actor_ip ?? null,
      entry.event_type,
      entry.resource_id ?? null,
      entry.resource_type ?? null,
      JSON.stringify(entry.metadata ?? {}),
      occurredAt,
      chainHash,
    ],
  );
}

export async function verifyAuditChain(
  orgId: string,
): Promise<{ valid: boolean; first_broken_at?: number }> {
  const { rows } = await pool.query(
    `SELECT id, event_type, resource_id, occurred_at, actor_id, chain_hash
     FROM audit_log
     WHERE org_id = $1
     ORDER BY id ASC`,
    [orgId],
  );

  let prevHash = GENESIS_HASH;

  for (const row of rows) {
    const expected = computeChainHash(
      prevHash,
      row.event_type,
      row.resource_id ?? "",
      new Date(row.occurred_at).toISOString(),
      row.actor_id ?? "",
    );
    if (expected !== row.chain_hash) {
      return { valid: false, first_broken_at: row.id };
    }
    prevHash = row.chain_hash;
  }

  return { valid: true };
}
