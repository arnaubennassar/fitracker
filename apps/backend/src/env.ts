import { z } from "zod";

const backendEnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_PATH: z.string().default(".data/app.db"),
  ADMIN_SEED_TOKEN: z.string().default("fitracker-admin-dev-token"),
  API_BASE_PATH: z.string().default("/api/v1"),
});

export const env = backendEnvSchema.parse(process.env);
