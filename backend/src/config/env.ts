import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const schema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  KMS_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  KMS_PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const env = schema.parse(process.env);
