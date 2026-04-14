import { z } from "zod";

export const WriteSecretSchema = z.object({
  environment: z.string().min(1),
  value: z.string(),
  tags: z.array(z.string()).optional().default([]),
  expires_at: z.string().datetime().optional(),
});

export const GetSecretSchema = z.object({
  environment: z.string().min(1),
  version: z.coerce.number().int().positive().optional(),
});

export const ListSecretsSchema = z.object({
  environment: z.string().min(1),
  search: z.string().optional(),
  tags: z.string().optional(),
  show_expired: z.enum(["true", "false"]).optional().default("false"),
});

export const DeleteSecretSchema = z.object({
  environment: z.string().min(1),
});

export const BulkExportSchema = z.object({
  environment: z.string().min(1),
  format: z.enum(["env", "json", "yaml"]),
});

export const RollbackSchema = z.object({
  environment: z.string().min(1),
  target_version: z.number().int().positive(),
});
