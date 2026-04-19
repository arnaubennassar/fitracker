import type { FastifyInstance } from "fastify";

import type { OpenApiPathItem } from "../routes/registry.js";

export function buildOpenApiDocument(app: FastifyInstance) {
  const paths = app.routeIndex.reduce<Record<string, OpenApiPathItem>>(
    (result, route) => {
      const method = route.method.toLowerCase();
      const existing = result[route.url] ?? {};
      const operation: OpenApiPathItem[string] = {
        operationId: route.operationId,
        responses: Object.fromEntries(
          Object.entries(route.response).map(([statusCode, responseSchema]) => [
            statusCode,
            {
              content: {
                [route.responseContentType]: {
                  schema: responseSchema,
                },
              },
              description:
                route.responseDescriptions?.[Number(statusCode)] ??
                "Successful response.",
            },
          ]),
        ),
        summary: route.summary,
        tags: route.tags,
      };

      if (route.security) {
        operation.security = route.security;
      }

      existing[method] = operation;

      result[route.url] = existing;

      return result;
    },
    {},
  );

  return {
    openapi: "3.1.0",
    info: {
      title: `${app.config.APP_NAME} API`,
      version: "0.1.0",
    },
    servers: [
      {
        url: "/",
      },
    ],
    tags: [
      {
        name: "system",
        description: "Service health, documentation, and bootstrap metadata.",
      },
      {
        name: "admin",
        description: "Coach/admin authentication foundation endpoints.",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "token",
          scheme: "bearer",
          type: "http",
        },
      },
    },
    paths,
  };
}
