import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../authz/middleware";
import {
  listSecrets,
  getSecret,
  writeSecret,
  deleteSecret,
  getSecretHistory,
  rollbackSecret,
  bulkExport,
} from "./secrets.service";
import {
  WriteSecretSchema,
  GetSecretSchema,
  ListSecretsSchema,
  DeleteSecretSchema,
  BulkExportSchema,
  RollbackSchema,
} from "./secrets.schema";

const router = Router({ mergeParams: true });

router.use(authenticate());

router.get(
  "/projects/:projectId/secrets",
  authorize("can_read", (req) => ({
    projectId: req.params.projectId,
    environment: (req.query.environment as string) ?? "",
    keyName: "*",
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ListSecretsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { environment, search, tags, show_expired } = parsed.data;
    const data = await listSecrets(
      req.params.projectId,
      environment,
      search,
      tags,
      show_expired === "true",
    );
    res.json({ data });
  },
);

router.get(
  "/projects/:projectId/secrets/:keyName/history",
  authorize("can_read", (req) => ({
    projectId: req.params.projectId,
    environment: (req.query.environment as string) ?? "",
    keyName: req.params.keyName,
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { environment } = req.query;
    if (!environment) {
      res.status(400).json({ error: "environment is required" });
      return;
    }
    const data = await getSecretHistory(
      req.params.projectId,
      req.params.keyName,
      environment as string,
    );
    res.json({ data });
  },
);

router.get(
  "/projects/:projectId/secrets/:keyName",
  authorize("can_read", (req) => ({
    projectId: req.params.projectId,
    environment: (req.query.environment as string) ?? "",
    keyName: req.params.keyName,
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = GetSecretSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { environment, version } = parsed.data;
    const data = await getSecret(
      req.params.projectId,
      req.params.keyName,
      environment,
      version,
      req.principal!,
      req.socket.remoteAddress,
    );
    res.json({ data });
  },
);

router.put(
  "/projects/:projectId/secrets/:keyName",
  authorize("can_write", (req) => ({
    projectId: req.params.projectId,
    environment: (req.body?.environment as string) ?? "",
    keyName: req.params.keyName,
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = WriteSecretSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { environment, value, tags, expires_at } = parsed.data;
    const result = await writeSecret(
      req.params.projectId,
      req.params.keyName,
      environment,
      value,
      tags,
      expires_at,
      req.principal!,
      req.socket.remoteAddress,
    );
    if (result.requiresApproval) {
      res.status(202).json({ data: result.changeRequest });
    } else {
      res.json({ data: result.secret });
    }
  },
);

router.delete(
  "/projects/:projectId/secrets/:keyName",
  authorize("can_delete", (req) => ({
    projectId: req.params.projectId,
    environment: (req.body?.environment as string) ?? "",
    keyName: req.params.keyName,
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = DeleteSecretSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    await deleteSecret(
      req.params.projectId,
      req.params.keyName,
      parsed.data.environment,
      req.principal!,
      req.socket.remoteAddress,
    );
    res.json({ data: { deleted: true } });
  },
);

router.post(
  "/projects/:projectId/secrets/:keyName/rollback",
  authorize("can_write", (req) => ({
    projectId: req.params.projectId,
    environment: (req.body?.environment as string) ?? "",
    keyName: req.params.keyName,
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = RollbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const data = await rollbackSecret(
      req.params.projectId,
      req.params.keyName,
      parsed.data.environment,
      parsed.data.target_version,
      req.principal!,
      req.socket.remoteAddress,
    );
    res.json({ data });
  },
);

router.post(
  "/projects/:projectId/secrets/bulk-export",
  authorize("can_read", (req) => ({
    projectId: req.params.projectId,
    environment: (req.body?.environment as string) ?? "",
    keyName: "*",
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = BulkExportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { environment, format } = parsed.data;
    const output = await bulkExport(
      req.params.projectId,
      environment,
      format,
      req.principal!,
      req.socket.remoteAddress,
    );
    const contentType = format === "json" ? "application/json" : "text/plain";
    res.set("Content-Type", contentType).send(output);
  },
);

export default router;
