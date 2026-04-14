import { Router, Response } from "express";
import { pool } from "../../db/client";
import { authenticate, AuthRequest } from "../authz/middleware";
import { verifyAuditChain } from "./auditLogger";

const router = Router({ mergeParams: true });

router.use(authenticate());

router.get(
  "/orgs/:orgId/audit",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { orgId } = req.params;
    const {
      actor_id,
      event_type,
      project_id,
      from,
      to,
      page = "1",
      limit = "50",
    } = req.query;

    const conditions: string[] = ["org_id = $1"];
    const params: unknown[] = [orgId];
    let idx = 2;

    if (actor_id) {
      conditions.push(`actor_id = $${idx++}`);
      params.push(actor_id);
    }
    if (event_type) {
      conditions.push(`event_type = $${idx++}`);
      params.push(event_type);
    }
    if (project_id) {
      conditions.push(`project_id = $${idx++}`);
      params.push(project_id);
    }
    if (from) {
      conditions.push(`occurred_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`occurred_at <= $${idx++}`);
      params.push(to);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    params.push(parseInt(limit as string), offset);

    const { rows } = await pool.query(
      `SELECT id, actor_type, actor_id, actor_ip, event_type,
            resource_id, resource_type, metadata, occurred_at
     FROM audit_log
     WHERE ${conditions.join(" AND ")}
     ORDER BY id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM audit_log WHERE ${conditions.join(" AND ")}`,
      params.slice(0, -2),
    );

    res.json({
      data: rows,
      total: parseInt(countRows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  },
);

router.get(
  "/orgs/:orgId/audit/verify",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { orgId } = req.params;
    const result = await verifyAuditChain(orgId);
    res.json(result);
  },
);

export default router;
