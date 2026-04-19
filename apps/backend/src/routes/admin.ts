import type { FastifyInstance } from "fastify";

import { getDb } from "../db/client.js";
import { env } from "../env.js";
import { requireAdminToken } from "../plugins/admin-auth.js";
import { listExercises } from "../repositories/exercises.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get(
    `${env.API_BASE_PATH}/admin/session`,
    { preHandler: requireAdminToken },
    async (request) => {
      return {
        tokenName: request.adminToken?.name ?? "unknown",
        scopes: request.adminToken?.scopes ?? [],
      };
    },
  );

  app.get(
    `${env.API_BASE_PATH}/admin/exercises`,
    { preHandler: requireAdminToken },
    async () => {
      const exercises = listExercises(getDb()).map((exercise) => ({
        id: exercise.id,
        slug: exercise.slug,
        name: exercise.name,
        category: exercise.category_name,
        trackingMode: exercise.tracking_mode,
        difficulty: exercise.difficulty,
        isActive: Boolean(exercise.is_active),
      }));

      return { items: exercises };
    },
  );
}
