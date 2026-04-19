import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { createDatabase } from "./db/client.js";
import { migrateDatabase } from "./db/migrations.js";
import type { AppEnv } from "./env.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { adminRoutes } from "./routes/admin.js";
import { buildDocsHtml } from "./routes/docs.js";
import { buildRouteSchema, registerRoutes } from "./routes/registry.js";
import { systemRoutes } from "./routes/system.js";

type BuildAppOptions = {
  env: AppEnv;
};

function respondOpenApi(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(buildOpenApiDocument(request.server));
}

function respondDocs(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .type("text/html; charset=utf-8")
    .send(buildDocsHtml(request.server.config));
}

export function buildApp({ env }: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  const db = createDatabase(env.DATABASE_PATH);
  migrateDatabase(db);

  app.decorate("config", env);
  app.decorate("db", db);

  app.addHook("onClose", async () => {
    db.close();
  });

  registerRoutes(app, [
    ...systemRoutes({
      apiBasePath: env.API_BASE_PATH,
      docsHandler: respondDocs,
      openApiHandler: respondOpenApi,
    }),
    ...adminRoutes({
      apiBasePath: env.API_BASE_PATH,
    }),
  ]);

  app.get(
    `${env.API_BASE_PATH}/openapi.json`,
    {
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Versioned OpenAPI alias",
        response: {
          200: {
            type: "object",
            additionalProperties: true,
          },
        },
      }),
    },
    respondOpenApi,
  );

  app.get(
    `${env.API_BASE_PATH}/docs`,
    {
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Versioned docs alias",
        response: {
          200: {
            type: "string",
          },
        },
        responseContentType: "text/html",
      }),
    },
    respondDocs,
  );

  return app;
}
