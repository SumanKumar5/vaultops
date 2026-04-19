import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../authz/middleware";
import {
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} from "./changeRequests.service";
import { z } from "zod";

const router = Router({ mergeParams: true });

router.use(authenticate());

router.get(
  "/projects/:projectId/change-requests",
  authorize("can_manage_policies", (req) => ({
    projectId: req.params.projectId,
    environment: "production",
    keyName: "PLACEHOLDER",
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { status } = req.query;
    const data = await listChangeRequests(
      req.params.projectId,
      status as string | undefined,
    );
    res.json({ data });
  },
);

router.post(
  "/projects/:projectId/change-requests/:id/approve",
  authorize("can_manage_policies", (req) => ({
    projectId: req.params.projectId,
    environment: "production",
    keyName: "PLACEHOLDER",
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await approveChangeRequest(
      req.params.projectId,
      req.params.id,
      req.principal!,
      req.socket.remoteAddress,
    );
    res.json({ data });
  },
);

router.post(
  "/projects/:projectId/change-requests/:id/reject",
  authorize("can_manage_policies", (req) => ({
    projectId: req.params.projectId,
    environment: "production",
    keyName: "PLACEHOLDER",
  })),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const schema = z.object({ review_note: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const data = await rejectChangeRequest(
      req.params.projectId,
      req.params.id,
      parsed.data.review_note,
      req.principal!,
      req.socket.remoteAddress,
    );
    res.json({ data });
  },
);

export default router;
