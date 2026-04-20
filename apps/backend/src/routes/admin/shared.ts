import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";

export type AdminRouteOptions = { apiBasePath: string };
export type PaginationQuery = {
  isActive?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
};

export const errorResponseSchema = {
  type: "object",
  required: ["statusCode"],
  properties: {
    code: { type: "string" },
    error: { type: "string" },
    message: { type: "string" },
    statusCode: { type: "integer" },
  },
  additionalProperties: true,
} as const;
export const idParamSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;
export const paginationQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    offset: { type: "integer", minimum: 0, default: 0 },
    search: { type: "string", minLength: 1, maxLength: 120 },
    isActive: { type: "boolean" },
    status: { type: "string", minLength: 1, maxLength: 40 },
  },
} as const;
export const paginationResponseSchema = {
  type: "object",
  required: ["limit", "offset", "total"],
  properties: {
    limit: { type: "integer" },
    offset: { type: "integer" },
    total: { type: "integer" },
  },
} as const;
export const dateSchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
} as const;
export const dateTimeSchema = { type: "string", format: "date-time" } as const;
export const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const;
export const nullableDateSchema = {
  anyOf: [dateSchema, { type: "null" }],
} as const;
export const nullableDateTimeSchema = {
  anyOf: [dateTimeSchema, { type: "null" }],
} as const;
export const nullableIntegerSchema = {
  anyOf: [{ type: "integer" }, { type: "null" }],
} as const;
export const nullableNumberSchema = {
  anyOf: [{ type: "number" }, { type: "null" }],
} as const;
export const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;
export function buildListResponseSchema(itemSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["items", "pagination"],
    properties: {
      items: { type: "array", items: itemSchema },
      pagination: paginationResponseSchema,
    },
  } as const;
}
export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
export function getPagination(query: PaginationQuery) {
  return {
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
    search: query.search?.trim() || null,
  };
}
export function parseJson<T>(value: string | null, fallback: T) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
export function toBoolean(value: number | null | undefined) {
  return value === 1;
}
export function toSqliteBoolean(value: boolean | undefined) {
  return value === undefined ? undefined : Number(value);
}
export function nowIsoString() {
  return new Date().toISOString();
}
export function sendNotFound(reply: FastifyReply, code: string, error: string) {
  return reply.code(404).send({ code, error, statusCode: 404 });
}
export function sendBadRequest(
  reply: FastifyReply,
  code: string,
  error: string,
) {
  return reply.code(400).send({ code, error, statusCode: 400 });
}
export function sendConflict(reply: FastifyReply, code: string, error: string) {
  return reply.code(409).send({ code, error, statusCode: 409 });
}
export function sendServerError(
  reply: FastifyReply,
  code: string,
  error: string,
) {
  return reply.code(500).send({ code, error, statusCode: 500 });
}
export function handleSqliteError(
  reply: FastifyReply,
  error: unknown,
  options: { conflictCode: string; conflictMessage: string },
) {
  if (error instanceof Error) {
    if (error.message.includes("UNIQUE constraint failed"))
      return sendConflict(reply, options.conflictCode, options.conflictMessage);
    if (error.message.includes("FOREIGN KEY constraint failed"))
      return sendConflict(
        reply,
        `${options.conflictCode}_REFERENCE`,
        "Referenced resource does not exist or is still in use.",
      );
    if (error.message.includes("CHECK constraint failed"))
      return sendBadRequest(
        reply,
        `${options.conflictCode}_CHECK`,
        "Input does not satisfy a database constraint.",
      );
  }
  throw error;
}
export function getRequiredAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.adminToken) {
    sendServerError(
      reply,
      "ADMIN_AUTH_CONTEXT_MISSING",
      "Admin auth context missing.",
    );
    return null;
  }
  return request.adminToken;
}
export function getEntityCount(
  db: DatabaseSync,
  tableName: string,
  whereClause = "",
  params: Array<string | number | null> = [],
) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName} ${whereClause}`)
    .get(...params) as { count: number };
  return row.count;
}
