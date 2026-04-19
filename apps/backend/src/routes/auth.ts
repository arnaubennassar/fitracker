import type { FastifyReply, FastifyRequest } from "fastify";

import type { AdminTokenRow } from "../db/schema.js";
import { verifyAdminToken } from "../lib/admin-token.js";

function unauthorized(
  reply: FastifyReply,
  message = "Missing or invalid bearer token.",
) {
  return reply.code(401).send({
    code: "ADMIN_TOKEN_UNAUTHORIZED",
    error: message,
    statusCode: 401,
  });
}

function parseAuthorizationHeader(headerValue?: string) {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

function isExpired(expiresAt: string | null, nowIso: string) {
  return expiresAt ? expiresAt < nowIso : false;
}

export function requireAdminAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = parseAuthorizationHeader(request.headers.authorization);

    if (!token) {
      return unauthorized(reply);
    }

    const now = new Date().toISOString();
    const rows = request.server.db
      .prepare(
        `
          SELECT
            id,
            name,
            token_hash,
            token_preview,
            scopes,
            last_used_at,
            expires_at,
            created_at,
            revoked_at
          FROM admin_tokens
          WHERE revoked_at IS NULL
        `,
      )
      .all() as AdminTokenRow[];

    const match = rows.find((row) => {
      if (isExpired(row.expires_at, now)) {
        return false;
      }

      return verifyAdminToken(token, row.token_hash);
    });

    if (!match) {
      return unauthorized(reply);
    }

    request.server.db
      .prepare(
        `
          UPDATE admin_tokens
          SET last_used_at = ?
          WHERE id = ?
        `,
      )
      .run(now, match.id);

    request.adminToken = {
      id: match.id,
      lastUsedAt: now,
      name: match.name,
      scopes: JSON.parse(match.scopes) as string[],
      tokenPreview: match.token_preview,
    };
  };
}
