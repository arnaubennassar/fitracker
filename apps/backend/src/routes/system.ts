import type { FastifyReply, FastifyRequest } from "fastify";

import { getMigrationCount } from "../db/migrations.js";
import type { AppRouteDefinition } from "./registry.js";
import { buildRouteSchema } from "./registry.js";

type SystemRouteHandlers = {
  apiBasePath: string;
  docsHandler: (request: FastifyRequest, reply: FastifyReply) => unknown;
  openApiHandler: (request: FastifyRequest, reply: FastifyReply) => unknown;
};

const rootResponse = {
  type: "object",
  required: ["app", "docsUrl", "healthUrl", "openApiUrl", "versionedApiBase"],
  properties: {
    app: {
      type: "string",
    },
    docsUrl: {
      type: "string",
    },
    healthUrl: {
      type: "string",
    },
    openApiUrl: {
      type: "string",
    },
    versionedApiBase: {
      type: "string",
    },
  },
} as const;

const healthResponse = {
  type: "object",
  required: ["database", "status", "time"],
  properties: {
    status: {
      type: "string",
    },
    time: {
      type: "string",
      format: "date-time",
    },
    database: {
      type: "object",
      required: ["migrationCount", "reachable"],
      properties: {
        migrationCount: {
          type: "integer",
        },
        reachable: {
          type: "boolean",
        },
      },
    },
  },
} as const;

async function getRoot(request: FastifyRequest) {
  return {
    app: request.server.config.APP_NAME,
    docsUrl: "/docs",
    healthUrl: "/health",
    openApiUrl: "/openapi.json",
    versionedApiBase: request.server.config.API_BASE_PATH,
  };
}

async function getHealth(request: FastifyRequest) {
  return {
    database: {
      migrationCount: getMigrationCount(request.server.db),
      reachable: true,
    },
    status: "ok",
    time: new Date().toISOString(),
  };
}

export function systemRoutes({
  apiBasePath,
  docsHandler,
  openApiHandler,
}: SystemRouteHandlers): AppRouteDefinition[] {
  return [
    {
      method: "GET",
      operationId: "getRoot",
      responseContentType: "application/json",
      response: {
        200: rootResponse,
      },
      summary: "Discover backend entrypoints.",
      tags: ["system"],
      url: "/",
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Discover backend entrypoints.",
        response: {
          200: rootResponse,
        },
      }),
      handler: getRoot,
    },
    {
      method: "GET",
      operationId: "getHealth",
      responseContentType: "application/json",
      response: {
        200: healthResponse,
      },
      summary: "Report service and database health.",
      tags: ["system"],
      url: "/health",
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Report service and database health.",
        response: {
          200: healthResponse,
        },
      }),
      handler: getHealth,
    },
    {
      method: "GET",
      operationId: "getVersionedHealth",
      responseContentType: "application/json",
      response: {
        200: healthResponse,
      },
      summary: "Report service and database health.",
      tags: ["system"],
      url: `${apiBasePath}/health`,
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Report service and database health.",
        response: {
          200: healthResponse,
        },
      }),
      handler: getHealth,
    },
    {
      method: "GET",
      operationId: "getOpenApiDocument",
      responseContentType: "application/json",
      response: {
        200: {
          type: "object",
          additionalProperties: true,
        },
      },
      summary: "Return the generated OpenAPI document.",
      tags: ["system"],
      url: "/openapi.json",
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Return the generated OpenAPI document.",
        response: {
          200: {
            type: "object",
            additionalProperties: true,
          },
        },
      }),
      handler: openApiHandler,
    },
    {
      method: "GET",
      operationId: "getDocsPage",
      responseContentType: "text/html",
      responseDescriptions: {
        200: "Human-readable API documentation page.",
      },
      response: {
        200: {
          type: "string",
        },
      },
      summary: "Render a lightweight API documentation page.",
      tags: ["system"],
      url: "/docs",
      schema: buildRouteSchema({
        tags: ["system"],
        summary: "Render a lightweight API documentation page.",
        response: {
          200: {
            type: "string",
          },
        },
        responseContentType: "text/html",
      }),
      handler: docsHandler,
    },
  ];
}
