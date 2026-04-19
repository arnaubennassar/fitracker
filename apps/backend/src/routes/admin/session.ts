import type { FastifyReply, FastifyRequest } from "fastify";
import { requireAdminAuth } from "../auth.js";
import type { AppRouteDefinition } from "../registry.js";
import { buildRouteSchema } from "../registry.js";
import type { AdminRouteOptions } from "./shared.js";
import { errorResponseSchema, getRequiredAdminToken } from "./shared.js";

const adminSessionResponse = {
  type: "object",
  required: ["authenticated", "token"],
  properties: {
    authenticated: { type: "boolean" },
    token: {
      type: "object",
      required: ["id", "name", "scopes", "tokenPreview"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        scopes: { type: "array", items: { type: "string" } },
        tokenPreview: { type: "string" },
        lastUsedAt: {
          anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
        },
      },
    },
  },
} as const;
async function getAdminSession(request: FastifyRequest, reply: FastifyReply) {
  const adminToken = getRequiredAdminToken(request, reply);
  if (!adminToken) return reply;
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
export function adminSessionRoutes({
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
      response: { 200: adminSessionResponse, 401: errorResponseSchema },
      summary: "Return the authenticated admin token context.",
      tags: ["admin-auth"],
      url: `${apiBasePath}/admin/session`,
      schema: buildRouteSchema({
        tags: ["admin-auth"],
        summary: "Return the authenticated admin token context.",
        response: { 200: adminSessionResponse, 401: errorResponseSchema },
      }),
      handler: getAdminSession,
      security: [{ bearerAuth: [] }],
    },
  ];
}
