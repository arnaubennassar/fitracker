import type { FastifyReply, FastifyRequest } from "fastify";

import { getDb } from "../db/client.js";
import { verifyToken } from "../lib/crypto.js";
import {
  findActiveAdminTokens,
  touchAdminToken,
} from "../repositories/admin-tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    adminToken?: {
      id: string;
      name: string;
      scopes: string[];
    };
  }
}

function readBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const providedToken = readBearerToken(request);

  if (!providedToken) {
    return reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "Missing bearer token.",
    });
  }

  const db = getDb();
  const candidates = findActiveAdminTokens(db);
  const match = candidates.find((candidate) => {
    if (
      candidate.expires_at &&
      Date.parse(candidate.expires_at) <= Date.now()
    ) {
      return false;
    }

    return verifyToken(providedToken, candidate.token_hash);
  });

  if (!match) {
    return reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "Invalid bearer token.",
    });
  }

  touchAdminToken(db, match.id);
  request.adminToken = {
    id: match.id,
    name: match.name,
    scopes: JSON.parse(match.scopes_json) as string[],
  };
}
