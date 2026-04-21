import { randomUUID } from "node:crypto";

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
import { registerMcpRoutes } from "./routes/mcp.js";
import { buildRouteSchema, registerRoutes } from "./routes/registry.js";
import { systemRoutes } from "./routes/system.js";
import { userRoutes } from "./routes/user.js";

type BuildAppOptions = {
  env: AppEnv;
};

function safeSerialize(value: unknown) {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

function getResourceType(request: FastifyRequest) {
  const pathname = request.url.split("?")[0] ?? request.url;
  const segments = pathname.split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");
  const resourceSegment = adminIndex >= 0 ? segments[adminIndex + 1] : null;

  return resourceSegment ?? null;
}

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

  app.setErrorHandler((error, request, reply) => {
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        details: (error as { validation: unknown }).validation,
        error: "Request validation failed.",
        statusCode: 400,
      });
    }

    request.log.error(error);

    return reply.code(500).send({
      code: "INTERNAL_SERVER_ERROR",
      error: "Unexpected server error.",
      statusCode: 500,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    if (
      !request.adminToken ||
      !["POST", "PATCH", "DELETE"].includes(request.method) ||
      !request.url.startsWith(`${env.API_BASE_PATH}/admin`) ||
      reply.statusCode >= 400
    ) {
      return;
    }

    const requestPath = request.url.split("?")[0] ?? request.url;
    const routePath = request.routeOptions.url ?? requestPath;

    app.db
      .prepare(
        `
          INSERT INTO admin_audit_logs (
            id,
            admin_token_id,
            admin_token_name,
            method,
            route_path,
            request_path,
            status_code,
            resource_type,
            resource_id,
            request_params,
            request_query,
            request_body,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        `adminaudit_${randomUUID().replaceAll("-", "")}`,
        request.adminToken.id,
        request.adminToken.name,
        request.method,
        routePath,
        requestPath,
        reply.statusCode,
        getResourceType(request),
        typeof request.params === "object" &&
          request.params !== null &&
          "id" in request.params
          ? String((request.params as { id?: string }).id ?? "") || null
          : null,
        safeSerialize(request.params),
        safeSerialize(request.query),
        safeSerialize(request.body),
        new Date().toISOString(),
      );
  });

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
    ...userRoutes({
      apiBasePath: env.API_BASE_PATH,
    }),
  ]);

  registerMcpRoutes(app);

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
