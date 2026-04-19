import { createHash, randomBytes } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import {
  appendSetCookieHeader,
  parseCookies,
  serializeCookie,
} from "./http.js";

const USER_SESSION_COOKIE_NAME = "fitracker_session";
const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type UserSessionRow = {
  display_name: string;
  expires_at: string;
  id: string;
  last_seen_at: string;
  status: string;
  user_id: string;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function shouldUseSecureCookies(request: FastifyRequest) {
  if (request.server.config.NODE_ENV === "production") {
    return true;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];

  return forwardedProto === "https";
}

function setSessionCookie(
  reply: FastifyReply,
  request: FastifyRequest,
  token: string,
  expiresAt: Date,
) {
  appendSetCookieHeader(
    reply,
    serializeCookie(USER_SESSION_COOKIE_NAME, token, {
      expires: expiresAt,
      maxAge: Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
      secure: shouldUseSecureCookies(request),
    }),
  );
}

export function getSessionOrigin(request: FastifyRequest) {
  const configuredOrigin = request.server.config.WEBAUTHN_ORIGIN;

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const originHeader = request.headers.origin;

  if (originHeader) {
    return originHeader;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];

  if (
    typeof forwardedProto === "string" &&
    typeof forwardedHost === "string" &&
    forwardedHost.length > 0
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.host;

  if (!host) {
    throw new Error("Unable to determine request origin for WebAuthn.");
  }

  return `http://${host}`;
}

export function getRpId(request: FastifyRequest) {
  return (
    request.server.config.WEBAUTHN_RP_ID ??
    new URL(getSessionOrigin(request)).hostname
  );
}

export function getRpName(request: FastifyRequest) {
  return (
    request.server.config.WEBAUTHN_RP_NAME ?? request.server.config.APP_NAME
  );
}

export function createUserSession(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() +
      request.server.config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const sessionId = `usersession_${randomBytes(16).toString("hex")}`;
  const sessionToken = randomBytes(32).toString("base64url");
  const nowIso = now.toISOString();
  const expiresAtIso = expiresAt.toISOString();

  request.server.db
    .prepare(
      `
        INSERT INTO user_sessions (
          id,
          user_id,
          session_token_hash,
          created_at,
          updated_at,
          last_seen_at,
          expires_at,
          revoked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `,
    )
    .run(
      sessionId,
      userId,
      hashSessionToken(sessionToken),
      nowIso,
      nowIso,
      nowIso,
      expiresAtIso,
    );

  setSessionCookie(reply, request, sessionToken, expiresAt);

  return {
    expiresAt: expiresAtIso,
    id: sessionId,
  };
}

export function clearUserSessionCookie(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  appendSetCookieHeader(
    reply,
    serializeCookie(USER_SESSION_COOKIE_NAME, "", {
      expires: new Date(0),
      maxAge: 0,
      secure: shouldUseSecureCookies(request),
    }),
  );
}

export function revokeUserSession(
  request: FastifyRequest,
  reply: FastifyReply,
  sessionId?: string,
) {
  if (sessionId) {
    request.server.db
      .prepare(
        `
          UPDATE user_sessions
          SET revoked_at = ?, updated_at = ?
          WHERE id = ? AND revoked_at IS NULL
        `,
      )
      .run(new Date().toISOString(), new Date().toISOString(), sessionId);
  }

  clearUserSessionCookie(request, reply);
}

export function resolveUserSession(request: FastifyRequest) {
  const sessionToken = parseCookies(request.headers.cookie)[
    USER_SESSION_COOKIE_NAME
  ];

  if (!sessionToken) {
    request.userSession = undefined;
    return null;
  }

  const nowIso = new Date().toISOString();
  const session = request.server.db
    .prepare(
      `
        SELECT
          user_sessions.id,
          user_sessions.user_id,
          user_sessions.last_seen_at,
          user_sessions.expires_at,
          users.display_name,
          users.status
        FROM user_sessions
        INNER JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.session_token_hash = ?
          AND user_sessions.revoked_at IS NULL
          AND user_sessions.expires_at > ?
        LIMIT 1
      `,
    )
    .get(hashSessionToken(sessionToken), nowIso) as UserSessionRow | undefined;

  if (!session || session.status !== "active") {
    request.userSession = undefined;
    return null;
  }

  request.userSession = {
    expiresAt: session.expires_at,
    id: session.id,
    lastSeenAt: session.last_seen_at,
    user: {
      displayName: session.display_name,
      id: session.user_id,
      status: session.status,
    },
  };

  const lastSeen = new Date(session.last_seen_at).getTime();

  if (
    Number.isFinite(lastSeen) &&
    Date.now() - lastSeen > SESSION_REFRESH_INTERVAL_MS
  ) {
    request.server.db
      .prepare(
        `
          UPDATE user_sessions
          SET last_seen_at = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(nowIso, nowIso, session.id);
    request.userSession.lastSeenAt = nowIso;
  }

  return request.userSession;
}

export function requireUserSession() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = resolveUserSession(request);

    if (!session) {
      return reply.code(401).send({
        code: "USER_SESSION_UNAUTHORIZED",
        error: "A valid user session is required.",
        statusCode: 401,
      });
    }
  };
}
