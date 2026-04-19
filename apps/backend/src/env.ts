import { z } from "zod";

const backendEnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = backendEnvSchema.parse(process.env);
