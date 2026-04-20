import type { DatabaseSync } from "node:sqlite";

import type { AppEnv } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppEnv;
    db: DatabaseSync;
  }

  interface FastifyRequest {
    adminToken?: {
      id: string;
      lastUsedAt: string | null;
      name: string;
      scopes: string[];
      tokenPreview: string;
    };
    userSession?:
      | {
          expiresAt: string;
          id: string;
          lastSeenAt: string;
        }
      | undefined;
  }
}
