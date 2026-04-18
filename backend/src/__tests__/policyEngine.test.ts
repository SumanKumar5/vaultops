import {
  resolvePermissions,
  resolvePrincipalFromToken,
  type Principal,
} from "../domain/authz/policyEngine";
import { pool } from "../db/client";

const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const TEST_ORG_ID = "00000000-0000-0000-0000-000000000099";
const USER_READ_ONLY: Principal = {
  id: "00000000-0000-0000-0000-000000000010",
  type: "user",
  scopedProjects: null,
};
const USER_ADMIN: Principal = {
  id: "00000000-0000-0000-0000-000000000011",
  type: "user",
  scopedProjects: null,
};
const SA_SCOPED: Principal = {
  id: "00000000-0000-0000-0000-000000000020",
  type: "service_account",
  scopedProjects: null,
};
const CI_TOKEN: Principal = {
  id: "00000000-0000-0000-0000-000000000030",
  type: "ci_token",
  scopedProjects: null,
};
const GRANTED_BY = "00000000-0000-0000-0000-000000000011";

async function seedPolicy(
  principalId: string,
  principalType: string,
  environments: string[],
  overrides: Record<string, unknown> = {},
  keyPattern: string | null = null,
) {
  await pool.query(
    `INSERT INTO secret_access_policies
      (project_id, principal_type, principal_id, environments,
       can_read, can_write, can_delete, can_manage_policies, key_pattern, granted_by)
     VALUES ($1,$2,$3,$4,
       $5,$6,$7,$8,$9,$10)`,
    [
      TEST_PROJECT_ID,
      principalType,
      principalId,
      environments,
      overrides.can_read ?? true,
      overrides.can_write ?? false,
      overrides.can_delete ?? false,
      overrides.can_manage_policies ?? false,
      keyPattern,
      GRANTED_BY,
    ],
  );
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO organisations (id, slug, name) VALUES ($1,'test-org','Test Org') ON CONFLICT DO NOTHING`,
    [TEST_ORG_ID],
  );
  await pool.query(
    `INSERT INTO projects (id, org_id, slug, name) VALUES ($1,$2,'test-proj','Test Project') ON CONFLICT DO NOTHING`,
    [TEST_PROJECT_ID, TEST_ORG_ID],
  );
});

beforeEach(async () => {
  await pool.query(`DELETE FROM secret_access_policies WHERE project_id = $1`, [
    TEST_PROJECT_ID,
  ]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM secret_access_policies WHERE project_id = $1`, [
    TEST_PROJECT_ID,
  ]);
  await pool.query(`DELETE FROM projects WHERE id = $1`, [TEST_PROJECT_ID]);
  await pool.query(`DELETE FROM organisations WHERE id = $1`, [TEST_ORG_ID]);
  await pool.end();
});

describe("policyEngine", () => {
  it("grants read when policy allows it", async () => {
    await seedPolicy(USER_READ_ONLY.id, "user", ["production"]);
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_read).toBe(true);
    expect(perms.can_write).toBe(false);
  });

  it("denies write for read-only user", async () => {
    await seedPolicy(USER_READ_ONLY.id, "user", ["production"], {
      can_read: true,
      can_write: false,
    });
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_write).toBe(false);
  });

  it("grants all permissions to admin user", async () => {
    await seedPolicy(USER_ADMIN.id, "user", ["production"], {
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_policies: true,
    });
    const perms = await resolvePermissions(
      USER_ADMIN,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_read).toBe(true);
    expect(perms.can_write).toBe(true);
    expect(perms.can_delete).toBe(true);
    expect(perms.can_manage_policies).toBe(true);
  });

  it("denies access when environment does not match", async () => {
    await seedPolicy(USER_READ_ONLY.id, "user", ["development"]);
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_read).toBe(false);
  });

  it("enforces key_pattern glob: DB_* matches DB_PASSWORD", async () => {
    await seedPolicy(
      SA_SCOPED.id,
      "service_account",
      ["production"],
      { can_read: true },
      "DB_*",
    );
    const perms = await resolvePermissions(
      SA_SCOPED,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_read).toBe(true);
  });

  it("enforces key_pattern glob: DB_* does not match API_KEY", async () => {
    await seedPolicy(
      SA_SCOPED.id,
      "service_account",
      ["production"],
      { can_read: true },
      "DB_*",
    );
    const perms = await resolvePermissions(
      SA_SCOPED,
      TEST_PROJECT_ID,
      "production",
      "API_KEY",
    );
    expect(perms.can_read).toBe(false);
  });

  it("denies access for expired policy", async () => {
    await pool.query(
      `INSERT INTO secret_access_policies
        (project_id, principal_type, principal_id, environments, can_read, granted_by, expires_at)
       VALUES ($1,'user',$2,ARRAY['production'],true,$3, NOW() - INTERVAL '1 hour')`,
      [TEST_PROJECT_ID, USER_READ_ONLY.id, GRANTED_BY],
    );
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_read).toBe(false);
  });

  it("CI token cannot delete or manage policies even if policy grants it", async () => {
    await seedPolicy(CI_TOKEN.id, "ci_token", ["production"], {
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_policies: true,
    });
    const perms = await resolvePermissions(
      CI_TOKEN,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_delete).toBe(false);
    expect(perms.can_manage_policies).toBe(false);
    expect(perms.can_read).toBe(true);
    expect(perms.can_write).toBe(true);
  });

  it("OR-merges multiple policies: most permissive wins", async () => {
    await seedPolicy(USER_READ_ONLY.id, "user", ["production"], {
      can_read: true,
      can_write: false,
    });
    await seedPolicy(USER_READ_ONLY.id, "user", ["production"], {
      can_read: true,
      can_write: true,
    });
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms.can_write).toBe(true);
  });

  it("returns all false when no policies exist", async () => {
    const perms = await resolvePermissions(
      USER_READ_ONLY,
      TEST_PROJECT_ID,
      "production",
      "DB_PASSWORD",
    );
    expect(perms).toEqual({
      can_read: false,
      can_write: false,
      can_delete: false,
      can_manage_policies: false,
    });
  });
  it("returns null principal for revoked service account token", async () => {
    const revokedToken = "revoked-sa-token-test-xyz";
    const revokedHash = require("crypto")
      .createHash("sha256")
      .update(revokedToken)
      .digest("hex");

    await pool.query(
      `INSERT INTO service_accounts
      (id, org_id, name, token_hash, is_ci_token, scoped_projects, revoked_at)
     VALUES (gen_random_uuid(), $1, 'Revoked SA', $2, false, ARRAY[]::UUID[], NOW())`,
      [TEST_ORG_ID, revokedHash],
    );

    const principal = await resolvePrincipalFromToken(revokedToken);
    expect(principal).toBeNull();

    await pool.query(`DELETE FROM service_accounts WHERE token_hash = $1`, [
      revokedHash,
    ]);
  });

  it("scoped_projects restricts service account to allowed projects", async () => {
    const scopedToken = "scoped-sa-token-test-xyz";
    const scopedHash = require("crypto")
      .createHash("sha256")
      .update(scopedToken)
      .digest("hex");

    const ALLOWED_PROJECT = TEST_PROJECT_ID;
    const OTHER_PROJECT = "c0000000-0000-0000-0000-000000000099";

    await pool.query(
      `INSERT INTO service_accounts
      (id, org_id, name, token_hash, is_ci_token, scoped_projects)
     VALUES (gen_random_uuid(), $1, 'Scoped SA', $2, false, ARRAY[$3]::UUID[])`,
      [TEST_ORG_ID, scopedHash, ALLOWED_PROJECT],
    );

    const principal = await resolvePrincipalFromToken(scopedToken);
    expect(principal).not.toBeNull();

    const allowedPerms = await resolvePermissions(
      principal!,
      ALLOWED_PROJECT,
      "production",
      "DB_PASSWORD",
    );
    const blockedPerms = await resolvePermissions(
      principal!,
      OTHER_PROJECT,
      "production",
      "DB_PASSWORD",
    );

    expect(blockedPerms).toEqual({
      can_read: false,
      can_write: false,
      can_delete: false,
      can_manage_policies: false,
    });

    await pool.query(`DELETE FROM service_accounts WHERE token_hash = $1`, [
      scopedHash,
    ]);
  });
});
