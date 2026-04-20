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
  dateTimeSchema,
  errorResponseSchema,
  nowIsoString,
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
  used_at: string | null;
};

type PasskeyRow = {
  counter: number;
  credential_id: string;
  id: number;
  public_key: string;
  transports: string;
};

const SINGLETON_WEBAUTHN_USER_ID = Buffer.from(
  "fitracker-athlete",
  "utf8",
).toString("base64url");
const SINGLETON_WEBAUTHN_USER_NAME = "athlete";
const SINGLETON_WEBAUTHN_USER_DISPLAY_NAME = "Fitracker athlete";

const authenticatorTransportSchema = {
  type: "string",
  enum: ["ble", "hybrid", "internal", "nfc", "smart-card", "usb"],
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
  required: ["authenticated", "session"],
  properties: {
    authenticated: { type: "boolean" },
    session: {
      anyOf: [authSessionSchema, { type: "null" }],
    },
  },
} as const;

const passkeyStatusResponseSchema = {
  type: "object",
  required: ["authenticated", "hasPasskey"],
  properties: {
    authenticated: { type: "boolean" },
    hasPasskey: { type: "boolean" },
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

function getStoredPasskey(request: FastifyRequest) {
  return request.server.db
    .prepare(
      `
        SELECT id, credential_id, public_key, counter, transports
        FROM athlete_passkey
        LIMIT 1
      `,
    )
    .get() as PasskeyRow | undefined;
}

function createStoredChallenge(
  request: FastifyRequest,
  flowType: "passkey_login" | "passkey_register",
) {
  cleanupExpiredChallenges(request);

  const id = `authchallenge_${crypto.randomUUID().replaceAll("-", "")}`;
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
          flow_type,
          challenge,
          created_at,
          expires_at,
          used_at
        )
        VALUES (?, ?, ?, ?, ?, NULL)
      `,
    )
    .run(id, flowType, challenge, now.toISOString(), expiresAt.toISOString());

  return { challenge, challengeId: id };
}

function getUnusedChallenge(
  request: FastifyRequest,
  challengeId: string,
  flowType: "passkey_login" | "passkey_register",
) {
  const row = request.server.db
    .prepare(
      `
        SELECT id, challenge, expires_at, used_at
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

function toAuthDescriptor(
  row: Pick<PasskeyRow, "credential_id" | "transports">,
) {
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
    };
  }

  return {
    authenticated: true,
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      lastSeenAt: session.lastSeenAt,
    },
  };
}

async function getPasskeyStatus(request: FastifyRequest) {
  return {
    authenticated: Boolean(resolveUserSession(request)),
    hasPasskey: Boolean(getStoredPasskey(request)),
  };
}

async function createRegisterOptions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (getStoredPasskey(request)) {
    return sendConflict(
      reply,
      "PASSKEY_ALREADY_REGISTERED",
      "A passkey is already registered.",
    );
  }

  const challenge = createStoredChallenge(request, "passkey_register");

  return {
    challengeId: challenge.challengeId,
    publicKey: {
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      challenge: challenge.challenge,
      excludeCredentials: [],
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      rp: {
        id: getRpId(request),
        name: getRpName(request),
      },
      timeout: request.server.config.AUTH_CHALLENGE_TTL_SECONDS * 1000,
      user: {
        displayName: SINGLETON_WEBAUTHN_USER_DISPLAY_NAME,
        id: SINGLETON_WEBAUTHN_USER_ID,
        name: SINGLETON_WEBAUTHN_USER_NAME,
      },
    },
  };
}

async function verifyRegister(request: FastifyRequest, reply: FastifyReply) {
  if (getStoredPasskey(request)) {
    return sendConflict(
      reply,
      "PASSKEY_ALREADY_REGISTERED",
      "A passkey is already registered.",
    );
  }

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

  if (!challenge) {
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

  const now = nowIsoString();

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO athlete_passkey (
            id,
            credential_id,
            public_key,
            counter,
            transports,
            created_at,
            last_used_at
          )
          VALUES (1, ?, ?, 0, ?, ?, NULL)
        `,
      )
      .run(
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
        "A passkey is already registered.",
      );
    }

    throw error;
  }

  markChallengeUsed(request, challenge.id);

  const session = createUserSession(request, reply);

  return {
    authenticated: true,
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      lastSeenAt: now,
    },
  };
}

async function createLoginOptions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const passkey = getStoredPasskey(request);

  if (!passkey) {
    return sendNotFound(
      reply,
      "PASSKEY_NOT_REGISTERED",
      "No registered passkey exists yet.",
    );
  }

  const challenge = createStoredChallenge(request, "passkey_login");

  return {
    challengeId: challenge.challengeId,
    publicKey: {
      allowCredentials: [toAuthDescriptor(passkey)],
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

  const passkey = getStoredPasskey(request);

  if (!passkey || passkey.credential_id !== body.credentialId) {
    return sendBadRequest(
      reply,
      "PASSKEY_LOGIN_CREDENTIAL_INVALID",
      "The supplied passkey could not be verified.",
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
          UPDATE athlete_passkey
          SET counter = ?, last_used_at = ?
          WHERE id = 1
        `,
      )
      .run(verified.counter, now);

    markChallengeUsed(request, challenge.id);

    const session = createUserSession(request, reply);

    return {
      authenticated: true,
      session: {
        expiresAt: session.expiresAt,
        id: session.id,
        lastSeenAt: now,
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
      method: "GET",
      operationId: "getPasskeyStatus",
      responseContentType: "application/json",
      response: {
        200: passkeyStatusResponseSchema,
      },
      summary: "Get singleton passkey bootstrap status.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/status`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Get singleton passkey bootstrap status.",
        response: {
          200: passkeyStatusResponseSchema,
        },
      }),
      handler: getPasskeyStatus,
    },
    {
      method: "POST",
      operationId: "createPasskeyRegisterOptions",
      responseContentType: "application/json",
      response: {
        200: registerOptionsResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create singleton passkey registration options.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/register/options`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Create singleton passkey registration options.",
        response: {
          200: registerOptionsResponseSchema,
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
      summary: "Verify singleton passkey registration and create a session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/register/verify`,
      schema: buildRouteSchema({
        body: registerVerifyBodySchema,
        tags: ["user-auth"],
        summary: "Verify singleton passkey registration and create a session.",
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
      },
      summary: "Create singleton passkey authentication options.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/login/options`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Create singleton passkey authentication options.",
        response: {
          200: loginOptionsResponseSchema,
          404: errorResponseSchema,
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
      summary: "Verify singleton passkey login and create a session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/passkey/login/verify`,
      schema: buildRouteSchema({
        body: loginVerifyBodySchema,
        tags: ["user-auth"],
        summary: "Verify singleton passkey login and create a session.",
        response: {
          200: authSessionResponseSchema,
          400: errorResponseSchema,
        },
      }),
      handler: verifyLogin,
    },
    {
      method: "GET",
      operationId: "getAuthSession",
      responseContentType: "application/json",
      response: {
        200: authSessionResponseSchema,
      },
      summary: "Get the current singleton authentication session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/me`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Get the current singleton authentication session.",
        response: {
          200: authSessionResponseSchema,
        },
      }),
      handler: getAuthSession,
    },
    {
      method: "POST",
      operationId: "logout",
      responseContentType: "application/json",
      response: {
        200: logoutResponseSchema,
      },
      summary: "Revoke the current singleton session.",
      tags: ["user-auth"],
      url: `${apiBasePath}/auth/logout`,
      schema: buildRouteSchema({
        tags: ["user-auth"],
        summary: "Revoke the current singleton session.",
        response: {
          200: logoutResponseSchema,
        },
      }),
      handler: logout,
    },
  ];
}
