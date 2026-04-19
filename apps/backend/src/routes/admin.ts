import type { FastifyReply, FastifyRequest } from "fastify";

import { requireAdminAuth } from "./auth.js";
import type { AppRouteDefinition } from "./registry.js";
import { buildRouteSchema } from "./registry.js";

type AdminRouteOptions = {
  apiBasePath: string;
};

const adminSessionResponse = {
  type: "object",
  required: ["authenticated", "token"],
  properties: {
    authenticated: {
      type: "boolean",
    },
    token: {
      type: "object",
      required: ["id", "name", "scopes", "tokenPreview"],
      properties: {
        id: {
          type: "string",
        },
        name: {
          type: "string",
        },
        scopes: {
          type: "array",
          items: {
            type: "string",
          },
        },
        tokenPreview: {
          type: "string",
        },
        lastUsedAt: {
          anyOf: [
            {
              type: "string",
              format: "date-time",
            },
            {
              type: "null",
            },
          ],
        },
      },
    },
  },
} as const;

async function getAdminSession(request: FastifyRequest, reply: FastifyReply) {
  const adminToken = request.adminToken;

  if (!adminToken) {
    return reply.code(500).send({
      code: "ADMIN_AUTH_CONTEXT_MISSING",
      error: "Admin auth context missing.",
      statusCode: 500,
    });
  }

  return {
    authenticated: true,
    token: {
      id: adminToken.id,
      lastUsedAt: adminToken.lastUsedAt,
      name: adminToken.name,
      scopes: adminToken.scopes,
      tokenPreview: adminToken.tokenPreview,
    },
  };
}

export function adminRoutes({
  apiBasePath,
}: AdminRouteOptions): AppRouteDefinition[] {
  return [
    {
      method: "GET",
      operationId: "getAdminSession",
      preHandler: requireAdminAuth(),
      responseContentType: "application/json",
      responseDescriptions: {
        200: "Authenticated admin token metadata.",
        401: "Missing or invalid bearer token.",
      },
      response: {
        200: adminSessionResponse,
        401: {
          type: "object",
          required: ["code", "error", "statusCode"],
          properties: {
            code: {
              type: "string",
            },
            error: {
              type: "string",
            },
            statusCode: {
              type: "integer",
            },
          },
        },
      },
      summary: "Return the authenticated admin token context.",
      tags: ["admin"],
      url: `${apiBasePath}/admin/session`,
      schema: buildRouteSchema({
        tags: ["admin"],
        summary: "Return the authenticated admin token context.",
        response: {
          200: adminSessionResponse,
          401: {
            type: "object",
            required: ["code", "error", "statusCode"],
            properties: {
              code: {
                type: "string",
              },
              error: {
                type: "string",
              },
              statusCode: {
                type: "integer",
              },
            },
          },
        },
      }),
      handler: getAdminSession,
      security: [{ bearerAuth: [] }],
    },
  ];
}
