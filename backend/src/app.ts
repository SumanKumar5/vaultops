import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import secretsRouter from "./domain/secrets/secrets.router";
import auditRouter from "./domain/audit/audit.router";
import changeRequestsRouter from "./domain/changeRequests/changeRequests.router";
import metricsRouter from "./services/metrics";
import { startExpiryJob } from "./domain/changeRequests/changeRequests.jobs";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

startExpiryJob();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1", secretsRouter);
app.use("/api/v1", auditRouter);
app.use("/api/v1", changeRequestsRouter);
app.use(metricsRouter);

app.use(
  (
    err: Error & { status?: number },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message ?? "Internal server error" });
  },
);

export default app;
