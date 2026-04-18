import { pool } from "../../db/client";
import crypto from "crypto";

export interface Principal {
  id: string;
  type: "user" | "service_account" | "ci_token";
  scopedProjects: string[] | null;
}

export interface Permissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_manage_policies: boolean;
}

interface PolicyRow {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_manage_policies: boolean;
  key_pattern: string | null;
  environments: string[];
  expires_at: Date | null;
}

function matchesGlob(pattern: string, key: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(key);
}

function mergePermissions(policies: PolicyRow[]): Permissions {
  const base: Permissions = {
    can_read: false,
    can_write: false,
    can_delete: false,
    can_manage_policies: false,
  };
  return policies.reduce<Permissions>(
    (acc, p) => ({
      can_read: acc.can_read || p.can_read,
      can_write: acc.can_write || p.can_write,
      can_delete: acc.can_delete || p.can_delete,
      can_manage_policies: acc.can_manage_policies || p.can_manage_policies,
    }),
    base,
  );
}

export async function resolvePermissions(
  principal: Principal,
  projectId: string,
  environment: string,
  keyName: string,
): Promise<Permissions> {
  if (
    principal.scopedProjects !== null &&
    principal.scopedProjects.length > 0 &&
    !principal.scopedProjects.includes(projectId)
  ) {
    return {
      can_read: false,
      can_write: false,
      can_delete: false,
      can_manage_policies: false,
    };
  }

  const { rows } = await pool.query<PolicyRow>(
    `SELECT can_read, can_write, can_delete, can_manage_policies,
            key_pattern, environments, expires_at
     FROM secret_access_policies
     WHERE project_id = $1
       AND principal_id = $2
       AND principal_type = $3`,
    [projectId, principal.id, principal.type],
  );

  const now = new Date();

  const matching = rows.filter((p) => {
    if (p.expires_at && p.expires_at < now) return false;
    if (!p.environments.includes(environment)) return false;
    if (p.key_pattern !== null && !matchesGlob(p.key_pattern, keyName))
      return false;
    return true;
  });

  const permissions = mergePermissions(matching);

  if (principal.type === "ci_token") {
    permissions.can_delete = false;
    permissions.can_manage_policies = false;
  }

  return permissions;
}

export async function resolvePrincipalFromToken(
  token: string,
): Promise<Principal | null> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { rows: saRows } = await pool.query(
    `SELECT id, is_ci_token, revoked_at, scoped_projects
     FROM service_accounts
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (saRows.length > 0) {
    const sa = saRows[0];
    if (sa.revoked_at) return null;
    await pool.query(
      `UPDATE service_accounts SET last_used_at = NOW() WHERE id = $1`,
      [sa.id],
    );
    return {
      id: sa.id,
      type: sa.is_ci_token ? "ci_token" : "service_account",
      scopedProjects: sa.scoped_projects as string[],
    };
  }

  const { rows: userRows } = await pool.query(
    `SELECT id FROM users WHERE token_hash = $1`,
    [tokenHash],
  );

  if (userRows.length > 0) {
    return { id: userRows[0].id, type: "user", scopedProjects: null };
  }

  return null;
}
