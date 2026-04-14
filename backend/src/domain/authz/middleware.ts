import { Request, Response, NextFunction } from "express";
import {
  resolvePermissions,
  resolvePrincipalFromToken,
  Principal,
  Permissions,
} from "./policyEngine";

export interface AuthRequest extends Request {
  principal?: Principal;
  permissions?: Permissions;
}

export function authenticate() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.slice(7);
    const principal = await resolvePrincipalFromToken(token);

    if (!principal) {
      res.status(401).json({ error: "Invalid or revoked token" });
      return;
    }

    req.principal = principal;
    next();
  };
}

export function authorize(
  action: keyof Permissions,
  getContext: (req: AuthRequest) => {
    projectId: string;
    environment: string;
    keyName: string;
  },
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const principal = req.principal;
    if (!principal) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const { projectId, environment, keyName } = getContext(req);
    const permissions = await resolvePermissions(
      principal,
      projectId,
      environment,
      keyName,
    );

    req.permissions = permissions;

    if (!permissions[action]) {
      res.status(403).json({
        error: "Forbidden",
        detail: `Principal does not have '${action}' on this resource`,
      });
      return;
    }

    next();
  };
}
