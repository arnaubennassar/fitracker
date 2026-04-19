import { z } from "zod";

const backendEnvSchema = z.object({
  APP_NAME: z.string().default("Fitracker"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_PATH: z.string().default(".data/app.db"),
  ADMIN_SEED_TOKEN: z
    .string()
    .min(24)
    .default("fitracker-local-admin-token-v1"),
  ADMIN_SEED_TOKEN_NAME: z.string().default("Local Coach Token"),
  API_BASE_PATH: z.string().default("/api/v1"),
});

export type AppEnv = z.infer<typeof backendEnvSchema>;

export function loadEnv(overrides: Partial<Record<keyof AppEnv, string>> = {}) {
  return backendEnvSchema.parse({
    ...process.env,
    ...overrides,
  });
}
