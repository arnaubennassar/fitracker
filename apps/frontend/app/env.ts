import { z } from "zod";

const frontendEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("/api/v1"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Fitracker"),
});

export const env = frontendEnvSchema.parse(process.env);
