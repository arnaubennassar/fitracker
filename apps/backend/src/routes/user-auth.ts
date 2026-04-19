import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createUserSession,
  getRpId,
  getRpName,
  getSessionOrigin,
  resolveUserSession,
  revokeUserSession,
} from "../lib/user-session.js";
import {
  createChallenge,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "../lib/webauthn.js";
import {
  createId,
  dateTimeSchema,
  errorResponseSchema,
  nowIsoString,
  nullableStringSchema,
  sendBadRequest,
  sendConflict,
  sendNotFound,
} from "./admin/shared.js";
import type { AppRouteDefinition } from "./registry.js";
import { buildRouteSchema } from "./registry.js";
import type { UserRouteOptions } from "./user.js";

type AuthChallengeRow = {
  challenge: string;
  expires_at: string;
  id: string;
  metadata: string;
  used_at: string | null;
  user_id: string | null;
};

type PasskeyRow = {
  counter: number;
  credential_id: string;
  display_name: string;
  id: string;
  public_key: string;
  status: string;
  transports: string;
  user_id: string;
};

type UserRow = {
  display_name: string;
  id: string;
  status: string;
};

const authenticatorTransportSchema = {
  type: "string",
  enum: ["ble", "hybrid", "internal", "nfc", "smart-card", "usb"],
} as const;

const authUserSchema = {
  type: "object",
  required: ["id", "displayName", "status"],
  properties: {
    id: { type: "string" },
    displayName: { type: "string" },
    status: { type: "string" },
  },
} as const;

const authSessionSchema = {
  type: "object",
  required: ["id", "expiresAt", "lastSeenAt"],
  properties: {
    id: { type: "string" },
    expiresAt: dateTimeSchema,
    lastSeenAt: dateTimeSchema,
  },
} as const;

const publicKeyCredentialDescriptorSchema = {
  type: "object",
  required: ["id", "type", "transports"],
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["public-key"] },
    transports: {
      type: "array",
      items: authenticatorTransportSchema,
    },
  },
} as const;

const registerOptionsBodySchema = {
  type: "object",
  required: ["userId", "displayName"],
  additionalProperties: false,
  properties: {
    userId: { type: "string", minLength: 1, maxLength: 120 },
    displayName: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;

const registerOptionsResponseSchema = {
  type: "object",
  required: ["challengeId", "publicKey"],
  properties: {
    challengeId: { type: "string" },
    publicKey: {
      type: "object",
      required: [
        "attestation",
        "challenge",
        "excludeCredentials",
        "pubKeyCredParams",
        "rp",
        "timeout",
        "user",
      ],
      properties: {
        challenge: { type: "string" },
        rp: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        user: {
          type: "object",
          required: ["displayName", "id", "name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            displayName: { type: "string" },
          },
        },
        pubKeyCredParams: {
          type: "array",
          items: {
            type: "object",
            required: ["alg", "type"],
            properties: {
              alg: { type: "integer" },
              type: { type: "string", enum: ["public-key"] },
            },
          },
        },
        timeout: { type: "integer" },
        attestation: { type: "string", enum: ["none"] },
        authenticatorSelection: {
          type: "object",
          required: ["residentKey", "userVerification"],
          properties: {
            residentKey: { type: "string", enum: ["preferred"] },
            userVerification: { type: "string", enum: ["preferred"] },
          },
        },
        excludeCredentials: {
          type: "array",
          items: publicKeyCredentialDescriptorSchema,
        },
      },
    },
  },
} as const;

const registerVerifyBodySchema = {
  type: "object",
  required: ["challengeId", "clientDataJSON", "credentialId", "publicKey"],
  additionalProperties: false,
  properties: {
    challengeId: { type: "string", minLength: 1 },
    credentialId: { type: "string", minLength: 1 },
    clientDataJSON: { type: "string", minLength: 1 },
    publicKey: { type: "string", minLength: 1 },
    transports: {
      type: "array",
      items: authenticatorTransportSchema,
    },
  },
} as const;

const loginOptionsBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    userId: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;

const loginOptionsResponseSchema = {
  type: "object",
  required: ["challengeId", "publicKey"],
  properties: {
    challengeId: { type: "string" },
    publicKey: {
      type: "object",
      required: [
        "allowCredentials",
        "challenge",
        "rpId",
        "timeout",
        "userVerification",
      ],
      properties: {
        challenge: { type: "string" },
        rpId: { type: "string" },
        timeout: { type: "integer" },
        userVerification: { type: "string", enum: ["required"] },
        allowCredentials: {
          type: "array",
          items: publicKeyCredentialDescriptorSchema,
        },
      },
    },
  },
} as const;

const loginVerifyBodySchema = {
  type: "object",
  required: [
    "authenticatorData",
    "challengeId",
    "clientDataJSON",
    "credentialId",
    "signature",
  ],
  additionalProperties: false,
  properties: {
    challengeId: { type: "string", minLength: 1 },
    credentialId: { type: "string", minLength: 1 },
    authenticatorData: { type: "string", minLength: 1 },
    clientDataJSON: { type: "string", minLength: 1 },
    signature: { type: "string", minLength: 1 },
  },
} as const;

const authSessionResponseSchema = {
  type: "object",
  required: ["authenticated", "session", "user"],
  properties: {
    authenticated: { type: "boolean" },
    user: {
      anyOf: [authUserSchema, { type: "null" }],
    },
    session: {
      anyOf: [authSessionSchema, { type: "null" }],
    },
  },
} as const;

const logoutResponseSchema = {
  type: "object",
  required: ["authenticated"],
  properties: {
    authenticated: { type: "boolean" },
  },
} as const;

function cleanupExpiredChallenges(request: FastifyRequest) {
  request.server.db
    .prepare(
      `
        DELETE FROM auth_challenges
        WHERE expires_at <= ? OR used_at IS NOT NULL
      `,
    )
    .run(nowIsoString());
}

function getActiveUser(request: FastifyRequest, userId: string) {
  return request.server.db
    .prepare(
      `
        SELECT id, display_name, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(userId) as UserRow | undefined;
}

function getPasskeysForUser(request: FastifyRequest, userId: string) {
  return request.server.db
    .prepare(
      `
        SELECT credential_id, transports
        FROM passkey_credentials
        WHERE user_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(userId) as Array<{
    credential_id: string;
    transports: string;
  }>;
}

function createStoredChallenge(
  request: FastifyRequest,
  options: {
    flowType: "passkey_login" | "passkey_register";
    metadata?: Record<string, unknown>;
    userId?: string;
  },
) {
  cleanupExpiredChallenges(request);

  const id = createId("authchallenge");
  const challenge = createChallenge();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + request.server.config.AUTH_CHALLENGE_TTL_SECONDS * 1000,
  );

  request.server.db
    .prepare(
      `
        INSERT INTO auth_challenges (
          id,
          user_id,
          flow_type,
          challenge,
          metadata,
          created_at,
          expires_at,
          used_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `,
    )
    .run(
      id,
      options.userId ?? null,
      options.flowType,
      challenge,
      JSON.stringify(options.metadata ?? {}),
      now.toISOString(),
      expiresAt.toISOString(),
    );

  return { challenge, challengeId: id, expiresAt: expiresAt.toISOString() };
}

function getUnusedChallenge(
  request: FastifyRequest,
  challengeId: string,
  flowType: "passkey_login" | "passkey_register",
) {
  const row = request.server.db
    .prepare(
      `
        SELECT id, user_id, challenge, metadata, expires_at, used_at
        FROM auth_challenges
        WHERE id = ? AND flow_type = ?
        LIMIT 1
      `,
    )
    .get(challengeId, flowType) as AuthChallengeRow | undefined;

  if (!row || row.used_at || row.expires_at <= nowIsoString()) {
    return null;
  }

  return row;
}

function markChallengeUsed(request: FastifyRequest, challengeId: string) {
  request.server.db
    .prepare(
      `
        UPDATE auth_challenges
        SET used_at = ?
        WHERE id = ?
      `,
    )
    .run(nowIsoString(), challengeId);
}

function toAuthDescriptor(row: {
  credential_id: string;
  transports: string;
}) {
  return {
    id: row.credential_id,
    type: "public-key" as const,
    transports: JSON.parse(row.transports) as string[],
  };
}

function mapAuthResponse(request: FastifyRequest) {
  const session = resolveUserSession(request);

  if (!session) {
    return {
      authenticated: false,
      session: null,
      user: null,
    };
  }

  return {
    authenticated: true,
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      lastSeenAt: session.lastSeenAt,
    },
    user: {
      displayName: session.user.displayName,
      id: session.user.id,
      status: session.user.status,
    },
  };
}

async function createRegisterOptions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = request.body as {
    displayName: string;
    userId: string;
  };
  const existingUser = getActiveUser(request, body.userId);

  if (existingUser && existingUser.status !== "active") {
    return sendConflict(
      reply,
      "USER_ACCOUNT_INACTIVE",
      "This user account is inactive.",
    );
  }

  const challenge = createStoredChallenge(request, {
    flowType: "passkey_register",
    metadata: {
      displayName: body.displayName,
    },
    userId: body.userId,
  });
  const passkeys = getPasskeysForUser(request, body.userId);

  return {
    challengeId: challenge.challengeId,
    publicKey: {
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      challenge: challenge.challenge,
      excludeCredentials: passkeys.map(toAuthDescriptor),
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      rp: {
        id: getRpId(request),
        name: getRpName(request),
      },
      timeout: request.server.config.AUTH_CHALLENGE_TTL_SECONDS * 1000,
      user: {
        displayName: body.displayName,
        id: body.userId,
        name: body.userId,
      },
    },
  };
}

async function verifyRegister(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    challengeId: string;
    clientDataJSON: string;
    credentialId: string;
    publicKey: string;
    transports?: string[];
  };
  const challenge = getUnusedChallenge(
    request,
    body.challengeId,
    "passkey_register",
  );

  if (!challenge || !challenge.user_id) {
    return sendBadRequest(
      reply,
      "PASSKEY_REGISTER_CHALLENGE_INVALID",
      "The registration challenge is invalid or expired.",
    );
  }

  try {
    verifyRegistrationResponse({
      clientDataJSON: body.clientDataJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getSessionOrigin(request),
    });
  } catch (error) {
    return sendBadRequest(
      reply,
      "PASSKEY_REGISTER_VERIFICATION_FAILED",
      error instanceof Error ? error.message : "Passkey registration failed.",
    );
  }

  const metadata = JSON.parse(challenge.metadata) as {
    displayName?: string;
  };
  const now = nowIsoString();
  const existingUser = getActiveUser(request, challenge.user_id);

  if (existingUser && existingUser.status !== "active") {
    return sendConflict(
      reply,
      "USER_ACCOUNT_INACTIVE",
      "This user account is inactive.",
    );
  }

  request.server.db
    .prepare(
      `
        INSERT INTO users (id, display_name, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          updated_at = excluded.updated_at
      `,
    )
    .run(
      challenge.user_id,
      metadata.displayName ?? challenge.user_id,
      now,
      now,
    );

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO passkey_credentials (
            id,
            user_id,
            credential_id,
            public_key,
            counter,
            transports,
            created_at,
            last_used_at
          )
          VALUES (?, ?, ?, ?, 0, ?, ?, NULL)
        `,
      )
      .run(
        createId("passkey"),
        challenge.user_id,
        body.credentialId,
        body.publicKey,
        JSON.stringify(body.transports ?? []),
        now,
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return sendConflict(
        reply,
        "PASSKEY_ALREADY_REGISTERED",
        "This passkey is already registered.",
      );
    }

    throw error;
  }

  markChallengeUsed(request, challenge.id);

  const session = createUserSession(request, reply, challenge.user_id);
  const user = getActiveUser(request, challenge.user_id);

  return {
    authenticated: true,
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      lastSeenAt: now,
    },
    user: {
      displayName:
        user?.display_name ?? metadata.displayName ?? challenge.user_id,
      id: challenge.user_id,
      status: "active",
    },
  };
}

async function createLoginOptions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = (request.body as { userId?: string } | undefined) ?? {};
  const challenge = createStoredChallenge(request, {
    flowType: "passkey_login",
    metadata: body.userId ? { userId: body.userId } : {},
    ...(body.userId ? { userId: body.userId } : {}),
  });

  let allowCredentials: Array<{
    credential_id: string;
    transports: string;
  }> = [];

  if (body.userId) {
    const user = getActiveUser(request, body.userId);

    if (!user) {
      return sendNotFound(reply, "USER_NOT_FOUND", "User not found.");
    }

    if (user.status !== "active") {
      return sendConflict(
        reply,
        "USER_ACCOUNT_INACTIVE",
        "This user account is inactive.",
      );
    }

    allowCredentials = getPasskeysForUser(request, body.userId);

    if (allowCredentials.length === 0) {
      return sendNotFound(
        reply,
        "PASSKEY_NOT_REGISTERED",
        "This user does not have a registered passkey.",
      );
    }
  }

  return {
    challengeId: challenge.challengeId,
    publicKey: {
      allowCredentials: allowCredentials.map(toAuthDescriptor),
      challenge: challenge.challenge,
      rpId: getRpId(request),
      timeout: request.server.config.AUTH_CHALLENGE_TTL_SECONDS * 1000,
      userVerification: "required",
    },
  };
}

async function verifyLogin(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    authenticatorData: string;
    challengeId: string;
    clientDataJSON: string;
    credentialId: string;
    signature: string;
  };
  const challenge = getUnusedChallenge(
    request,
    body.challengeId,
    "passkey_login",
  );

  if (!challenge) {
    return sendBadRequest(
      reply,
      "PASSKEY_LOGIN_CHALLENGE_INVALID",
      "The login challenge is invalid or expired.",
    );
  }

  const passkey = request.server.db
    .prepare(
      `
        SELECT
          passkey_credentials.id,
          passkey_credentials.user_id,
          passkey_credentials.credential_id,
          passkey_credentials.public_key,
          passkey_credentials.counter,
          passkey_credentials.transports,
          users.display_name,
          users.status
        FROM passkey_credentials
        INNER JOIN users ON users.id = passkey_credentials.user_id
        WHERE passkey_credentials.credential_id = ?
        LIMIT 1
      `,
    )
    .get(body.credentialId) as PasskeyRow | undefined;

  if (!passkey || passkey.status !== "active") {
    return sendBadRequest(
      reply,
      "PASSKEY_LOGIN_CREDENTIAL_INVALID",
      "The supplied passkey could not be verified.",
    );
  }

  if (challenge.user_id && challenge.user_id !== passkey.user_id) {
    return sendBadRequest(
      reply,
      "PASSKEY_LOGIN_CREDENTIAL_MISMATCH",
      "The supplied passkey does not belong to the requested user.",
    );
  }

  try {
    const verified = verifyAuthenticationResponse({
      authenticatorData: body.authenticatorData,
      clientDataJSON: body.clientDataJSON,
      currentCounter: passkey.counter,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getSessionOrigin(request),
      expectedRpId: getRpId(request),
      publicKey: passkey.public_key,
      signature: body.signature,
    });
    const now = nowIsoString();

    request.server.db
      .prepare(
        `
          UPDATE passkey_credentials
          SET counter = ?, last_used_at = ?
          WHERE id = ?
        `,
      )
      .run(verified.counter, now, passkey.id);

    markChallengeUsed(request, challenge.id);

    const session = createUserSession(request, reply, passkey.user_id);

    return {
      authenticated: true,
      session: {
        expiresAt: session.expiresAt,
        id: session.id,
        lastSeenAt: now,
      },
      user: {
        displayName: passkey.display_name,
        id: passkey.user_id,
        status: passkey.status,
      },
    };
  } catch (error) {
    return sendBadRequest(
      reply,
      "PASSKEY_LOGIN_VERIFICATION_FAILED",
      error instanceof Error ? error.message : "Passkey login failed.",
    );
  }
}

async function getAuthSession(request: FastifyRequest) {
  return mapAuthResponse(request);
}

async function logout(request: FastifyRequest, reply: FastifyReply) {
  const session = resolveUserSession(request);
  revokeUserSession(request, reply, session?.id);

  return {
    authenticated: false,
  };
}

export function userAuthRoutes({
  apiBasePath,
}: UserRouteOptions): AppRouteDefinition[] {
  return [
    {
      method: "POST",
      operationId: "createPasskeyRegisterOptions",
      responseContentType: "application/json",
      response: {
        200: registerOptionsResponseSchema,
        400: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create passkey registration options for a user.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/register/options`,
      schema: buildRouteSchema({
        body: registerOptionsBodySchema,
        tags: ["user-auth"],
        summary: "Create passkey registration options for a user.",
        response: {
          200: registerOptionsResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createRegisterOptions,
    },
    {
      method: "POST",
      operationId: "verifyPasskeyRegister",
      responseContentType: "application/json",
      response: {
        200: authSessionResponseSchema,
        400: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Verify a passkey registration and create a session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/register/verify`,
      schema: buildRouteSchema({
        body: registerVerifyBodySchema,
        tags: ["user-auth"],
        summary: "Verify a passkey registration and create a session.",
        response: {
          200: authSessionResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: verifyRegister,
    },
    {
      method: "POST",
      operationId: "createPasskeyLoginOptions",
      responseContentType: "application/json",
      response: {
        200: loginOptionsResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create passkey authentication options.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/login/options`,
      schema: buildRouteSchema({
        body: loginOptionsBodySchema,
        tags: ["user-auth"],
        summary: "Create passkey authentication options.",
        response: {
          200: loginOptionsResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createLoginOptions,
    },
    {
      method: "POST",
      operationId: "verifyPasskeyLogin",
      responseContentType: "application/json",
      response: {
        200: authSessionResponseSchema,
        400: errorResponseSchema,
      },
      summary: "Verify a passkey assertion and create a session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/login/verify`,
      schema: buildRouteSchema({
        body: loginVerifyBodySchema,
        tags: ["user-auth"],
        summary: "Verify a passkey assertion and create a session.",
        response: {
          200: authSessionResponseSchema,
          400: errorResponseSchema,
        },
      }),
      handler: verifyLogin,
    },
    {
      method: "POST",
      operationId: "logoutUser",
      responseContentType: "application/json",
      response: {
        200: logoutResponseSchema,
      },
      summary: "Revoke the active user session cookie if present.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/logout`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Revoke the active user session cookie if present.",
        response: {
          200: logoutResponseSchema,
        },
      }),
      handler: logout,
    },
    {
      method: "GET",
      operationId: "getUserSession",
      responseContentType: "application/json",
      response: {
        200: authSessionResponseSchema,
      },
      summary: "Inspect the current user session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/me`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Inspect the current user session.",
        response: {
          200: authSessionResponseSchema,
        },
      }),
      handler: getAuthSession,
    },
  ];
}
