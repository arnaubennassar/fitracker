import type { FastifyInstance } from "fastify";

import type { OpenApiPathItem } from "../routes/registry.js";

function schemaPropertiesToParameters(
  location: "path" | "query",
  schema: Record<string, unknown>,
) {
  const properties =
    "properties" in schema && typeof schema.properties === "object"
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
  const required =
    "required" in schema && Array.isArray(schema.required)
      ? new Set(schema.required as string[])
      : new Set<string>();

  return Object.entries(properties).map(([name, parameterSchema]) => ({
    in: location,
    name,
    required: location === "path" ? true : required.has(name),
    schema: parameterSchema,
  }));
}

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

      if (route.schema.querystring) {
        operation.parameters = [
          ...(operation.parameters ?? []),
          ...schemaPropertiesToParameters("query", route.schema.querystring),
        ];
      }

      if (route.schema.params) {
        operation.parameters = [
          ...(operation.parameters ?? []),
          ...schemaPropertiesToParameters("path", route.schema.params),
        ];
      }

      if (route.schema.body) {
        operation.requestBody = {
          content: {
            "application/json": {
              schema: route.schema.body,
            },
          },
          required: true,
        };
      }

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
        name: "admin-auth",
        description: "Coach/admin authentication endpoints.",
      },
      {
        name: "admin-catalog",
        description: "Exercise categories, exercises, and media management.",
      },
      {
        name: "admin-workouts",
        description:
          "Workout template authoring and ordered template exercises.",
      },
      {
        name: "admin-assignments",
        description: "Workout template assignments for users.",
      },
      {
        name: "admin-reporting",
        description:
          "Admin reporting on performed sessions, feedback, and adherence.",
      },
      {
        name: "user-auth",
        description:
          "Athlete passkey registration, passkey login, and session inspection.",
      },
      {
        name: "user-workouts",
        description:
          "Athlete workout assignment, workout session, set logging, and feedback flows.",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "token",
          scheme: "bearer",
          type: "http",
        },
        sessionCookieAuth: {
          in: "cookie",
          name: "fitracker_session",
          type: "apiKey",
        },
      },
    },
    paths,
  };
}
