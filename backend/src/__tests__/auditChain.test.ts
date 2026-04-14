import { writeAuditLog, verifyAuditChain } from "../domain/audit/auditLogger";
import { pool } from "../db/client";

const TEST_ORG = "00000000-0000-0000-0000-000000000077";
const TEST_ORG_2 = "00000000-0000-0000-0000-000000000078";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const RESOURCE = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  await pool.query(
    `INSERT INTO organisations (id, slug, name) VALUES ($1,'audit-test-org','Audit Test') ON CONFLICT DO NOTHING`,
    [TEST_ORG],
  );
  await pool.query(
    `INSERT INTO organisations (id, slug, name) VALUES ($1,'audit-test-org-2','Audit Test 2') ON CONFLICT DO NOTHING`,
    [TEST_ORG_2],
  );
});

beforeEach(async () => {
  await pool.query(`DELETE FROM audit_log WHERE org_id = $1 OR org_id = $2`, [
    TEST_ORG,
    TEST_ORG_2,
  ]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM audit_log WHERE org_id = $1 OR org_id = $2`, [
    TEST_ORG,
    TEST_ORG_2,
  ]);
  await pool.query(`DELETE FROM organisations WHERE id = $1 OR id = $2`, [
    TEST_ORG,
    TEST_ORG_2,
  ]);
  await pool.end();
});

describe("auditLogger", () => {
  it("writes an audit entry successfully", async () => {
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_READ",
      resource_id: RESOURCE,
      resource_type: "secret",
    });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE org_id = $1`,
      [TEST_ORG],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("SECRET_READ");
    expect(rows[0].chain_hash).toHaveLength(64);
  });

  it("verifies a valid chain", async () => {
    for (let i = 0; i < 5; i++) {
      await writeAuditLog({
        org_id: TEST_ORG,
        actor_type: "user",
        actor_id: ACTOR,
        event_type: "SECRET_READ",
        resource_id: RESOURCE,
        resource_type: "secret",
      });
    }

    const result = await verifyAuditChain(TEST_ORG);
    expect(result.valid).toBe(true);
    expect(result.first_broken_at).toBeUndefined();
  });

  it("returns valid=true for empty chain", async () => {
    const result = await verifyAuditChain(TEST_ORG);
    expect(result.valid).toBe(true);
  });

  it("detects a tampered entry", async () => {
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_WRITTEN",
      resource_id: RESOURCE,
    });

    await pool.query(
      `UPDATE audit_log SET chain_hash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
       WHERE org_id = $1`,
      [TEST_ORG],
    );

    const result = await verifyAuditChain(TEST_ORG);
    expect(result.valid).toBe(false);
    expect(result.first_broken_at).toBeDefined();
  });

  it("chains correctly: each entry references previous hash", async () => {
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_READ",
      resource_id: RESOURCE,
    });
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_WRITTEN",
      resource_id: RESOURCE,
    });
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_DELETED",
      resource_id: RESOURCE,
    });

    const { rows } = await pool.query(
      `SELECT chain_hash FROM audit_log WHERE org_id = $1 ORDER BY id ASC`,
      [TEST_ORG],
    );

    expect(rows[0].chain_hash).not.toBe(rows[1].chain_hash);
    expect(rows[1].chain_hash).not.toBe(rows[2].chain_hash);

    const result = await verifyAuditChain(TEST_ORG);
    expect(result.valid).toBe(true);
  });

  it("chains are isolated per org", async () => {
    await writeAuditLog({
      org_id: TEST_ORG,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_READ",
      resource_id: RESOURCE,
    });
    await writeAuditLog({
      org_id: TEST_ORG_2,
      actor_type: "user",
      actor_id: ACTOR,
      event_type: "SECRET_READ",
      resource_id: RESOURCE,
    });

    const r1 = await verifyAuditChain(TEST_ORG);
    const r2 = await verifyAuditChain(TEST_ORG_2);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });
});
