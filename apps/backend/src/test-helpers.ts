import {
  type KeyObject,
  createHash,
  createSign,
  generateKeyPairSync,
} from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { type AppEnv, loadEnv } from "./env.js";

export function createTestEnv() {
  const directory = mkdtempSync(join(tmpdir(), "fitracker-backend-"));
  const env = loadEnv({
    DATABASE_PATH: join(directory, "test.db"),
    NODE_ENV: "test",
    ADMIN_SEED_TOKEN: "fitracker-local-admin-token-for-tests",
    ADMIN_SEED_TOKEN_NAME: "Test Coach Token",
  });

  return {
    cleanup() {
      rmSync(directory, {
        force: true,
        recursive: true,
      });
    },
    env,
  };
}

export function createWebAuthnTestEnv(env: AppEnv) {
  return loadEnv({
    DATABASE_PATH: env.DATABASE_PATH,
    NODE_ENV: "test",
    ADMIN_SEED_TOKEN: env.ADMIN_SEED_TOKEN,
    ADMIN_SEED_TOKEN_NAME: env.ADMIN_SEED_TOKEN_NAME,
    WEBAUTHN_ORIGIN: "http://localhost:3000",
    WEBAUTHN_RP_ID: "localhost",
    WEBAUTHN_RP_NAME: "Fitracker Test",
  });
}

export function parseSessionCookie(
  setCookieHeader: string[] | string | undefined,
) {
  if (!setCookieHeader) return null;
  const header = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  for (const value of header) {
    const match = /fitracker_session=([^;]+)/.exec(value);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function encodeClientDataJSON(payload: {
  challenge: string;
  origin: string;
  type: "webauthn.create" | "webauthn.get";
}) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function buildAuthenticatorData(rpId: string, counter: number) {
  const rpIdHash = createHash("sha256").update(rpId).digest();
  const flags = Buffer.from([0x05]);
  const counterBuffer = Buffer.alloc(4);
  counterBuffer.writeUInt32BE(counter, 0);
  return Buffer.concat([rpIdHash, flags, counterBuffer]);
}

export function signAssertion(
  privateKey: KeyObject,
  authenticatorData: Buffer,
  clientDataJSON: string,
) {
  const clientDataHash = createHash("sha256")
    .update(Buffer.from(clientDataJSON, "base64url"))
    .digest();
  const signer = createSign("sha256");
  signer.update(Buffer.concat([authenticatorData, clientDataHash]));
  signer.end();
  return signer.sign(privateKey);
}

export function createTestAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const spki = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey,
    publicKeyBase64Url: Buffer.from(spki).toString("base64url"),
  };
}

export async function registerPasskeySession(
  app: FastifyInstance,
  options?: {
    credentialId?: string;
    host?: string;
    origin?: string;
  },
) {
  const origin = options?.origin ?? "http://localhost:3000";
  const host = options?.host ?? "localhost:3000";
  const credentialId = options?.credentialId ?? "cred_test_primary";
  const authenticator = createTestAuthenticator();

  const registerOptions = await app.inject({
    method: "POST",
    url: "/api/v1/auth/passkey/register/options",
    headers: { origin, host },
  });

  const optionsPayload = registerOptions.json();
  const registerVerify = await app.inject({
    method: "POST",
    url: "/api/v1/auth/passkey/register/verify",
    headers: { origin, host },
    payload: {
      challengeId: optionsPayload.challengeId,
      credentialId,
      clientDataJSON: encodeClientDataJSON({
        type: "webauthn.create",
        challenge: optionsPayload.publicKey.challenge,
        origin,
      }),
      publicKey: authenticator.publicKeyBase64Url,
      transports: ["internal"],
    },
  });

  const sessionCookie = parseSessionCookie(
    registerVerify.headers["set-cookie"] as string[] | string | undefined,
  );

  return {
    authenticator,
    credentialId,
    host,
    origin,
    registerOptions,
    registerVerify,
    rpId: "localhost",
    sessionCookie,
  };
}
