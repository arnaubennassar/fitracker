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
  MCP_BASE_PATH: z.string().default("/mcp"),
  MCP_ADMIN_TOKEN: z.string().min(1).optional(),
  AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEBAUTHN_ORIGIN: z.string().url().optional(),
  WEBAUTHN_RP_ID: z.string().min(1).optional(),
  WEBAUTHN_RP_NAME: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof backendEnvSchema>;

export function loadEnv(overrides: Partial<Record<keyof AppEnv, string>> = {}) {
  return backendEnvSchema.parse({
    ...process.env,
    ...overrides,
  });
}
