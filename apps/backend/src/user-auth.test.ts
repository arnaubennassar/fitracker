import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "./app.js";
import { seedDatabase } from "./db/seeds.js";
import {
  buildAuthenticatorData,
  createTestAuthenticator,
  createTestEnv,
  createWebAuthnTestEnv,
  encodeClientDataJSON,
  registerPasskeySession,
  signAssertion,
} from "./test-helpers.js";

test("auth me reports unauthenticated after logout revokes the session", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const anonymous = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    assert.equal(anonymous.statusCode, 200);
    assert.equal(anonymous.json().authenticated, false);

    const registration = await registerPasskeySession(app);
    assert.equal(registration.registerVerify.statusCode, 200);
    assert.ok(registration.sessionCookie);

    const headers = {
      cookie: `fitracker_session=${registration.sessionCookie}`,
    };

    const active = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers,
    });

    assert.equal(active.statusCode, 200);
    assert.equal(active.json().authenticated, true);
    const sessionId = active.json().session.id;

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers,
    });

    assert.equal(logout.statusCode, 200);
    assert.equal(logout.json().authenticated, false);

    const revoked = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers,
    });

    assert.equal(revoked.statusCode, 200);
    assert.equal(revoked.json().authenticated, false);

    const revokedSession = app.db
      .prepare(
        `
          SELECT revoked_at
          FROM athlete_sessions
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(sessionId) as { revoked_at: string | null } | undefined;

    assert.ok(revokedSession?.revoked_at);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("passkey login challenges cannot be reused after a successful login", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const registration = await registerPasskeySession(app, {
      credentialId: "cred_test_reuse",
    });
    assert.equal(registration.registerVerify.statusCode, 200);

    const loginOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/options",
      headers: { origin: registration.origin, host: registration.host },
    });

    assert.equal(loginOptions.statusCode, 200);
    const loginOptionsPayload = loginOptions.json();
    const authenticatorData = buildAuthenticatorData(registration.rpId, 1);
    const clientDataJSON = encodeClientDataJSON({
      type: "webauthn.get",
      challenge: loginOptionsPayload.publicKey.challenge,
      origin: registration.origin,
    });
    const signature = signAssertion(
      registration.authenticator.privateKey,
      authenticatorData,
      clientDataJSON,
    );
    const payload = {
      challengeId: loginOptionsPayload.challengeId,
      credentialId: registration.credentialId,
      authenticatorData: authenticatorData.toString("base64url"),
      clientDataJSON,
      signature: signature.toString("base64url"),
    };

    const verified = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/verify",
      headers: { origin: registration.origin, host: registration.host },
      payload,
    });

    assert.equal(verified.statusCode, 200);
    assert.equal(verified.json().authenticated, true);

    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/verify",
      headers: { origin: registration.origin, host: registration.host },
      payload,
    });

    assert.equal(reused.statusCode, 400);
    assert.equal(reused.json().code, "PASSKEY_LOGIN_CHALLENGE_INVALID");

    const storedChallenge = app.db
      .prepare(
        `
          SELECT used_at
          FROM auth_challenges
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(payload.challengeId) as { used_at: string | null } | undefined;

    assert.ok(storedChallenge?.used_at);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("passkey registration rejects duplicate credentials and invalid challenges", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const registration = await registerPasskeySession(app, {
      credentialId: "cred_duplicate",
    });
    assert.equal(registration.registerVerify.statusCode, 200);

    const duplicateOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/options",
      headers: { origin: registration.origin, host: registration.host },
    });
    const duplicateVerify = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/verify",
      headers: { origin: registration.origin, host: registration.host },
      payload: {
        challengeId: duplicateOptions.json().challengeId,
        clientDataJSON: encodeClientDataJSON({
          challenge: duplicateOptions.json().publicKey.challenge,
          origin: registration.origin,
          type: "webauthn.create",
        }),
        credentialId: registration.credentialId,
        publicKey: registration.authenticator.publicKeyBase64Url,
        transports: ["internal"],
      },
    });

    assert.equal(duplicateVerify.statusCode, 409);
    assert.equal(duplicateVerify.json().code, "PASSKEY_ALREADY_REGISTERED");

    const invalidChallenge = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/verify",
      headers: { origin: registration.origin, host: registration.host },
      payload: {
        challengeId: "challenge_missing",
        clientDataJSON: encodeClientDataJSON({
          challenge: "challenge_missing",
          origin: registration.origin,
          type: "webauthn.create",
        }),
        credentialId: "cred_invalid",
        publicKey: registration.authenticator.publicKeyBase64Url,
      },
    });

    assert.equal(invalidChallenge.statusCode, 400);
    assert.equal(
      invalidChallenge.json().code,
      "PASSKEY_REGISTER_CHALLENGE_INVALID",
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("passkey verification fails on origin mismatch and invalid signatures", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const registrationOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/options",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    const authenticator = createTestAuthenticator();

    const originMismatch = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/verify",
      headers: { origin: "http://127.0.0.1:3000", host: "localhost:3000" },
      payload: {
        challengeId: registrationOptions.json().challengeId,
        credentialId: "cred_origin_mismatch",
        clientDataJSON: encodeClientDataJSON({
          challenge: registrationOptions.json().publicKey.challenge,
          origin: "http://localhost:3000",
          type: "webauthn.create",
        }),
        publicKey: authenticator.publicKeyBase64Url,
      },
    });

    assert.equal(originMismatch.statusCode, 400);
    assert.equal(
      originMismatch.json().code,
      "PASSKEY_REGISTER_VERIFICATION_FAILED",
    );

    const registration = await registerPasskeySession(app, {
      credentialId: "cred_invalid_signature",
    });
    const loginOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/options",
      headers: { origin: registration.origin, host: registration.host },
    });
    const authenticatorData = buildAuthenticatorData(registration.rpId, 1);
    const clientDataJSON = encodeClientDataJSON({
      challenge: loginOptions.json().publicKey.challenge,
      origin: registration.origin,
      type: "webauthn.get",
    });

    const invalidLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/verify",
      headers: { origin: registration.origin, host: registration.host },
      payload: {
        challengeId: loginOptions.json().challengeId,
        credentialId: registration.credentialId,
        authenticatorData: authenticatorData.toString("base64url"),
        clientDataJSON,
        signature: Buffer.from("bad-signature").toString("base64url"),
      },
    });

    assert.equal(invalidLogin.statusCode, 400);
    assert.equal(invalidLogin.json().code, "PASSKEY_LOGIN_VERIFICATION_FAILED");
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("logout clears auth state even when no active session cookie is present", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    assert.equal(logout.statusCode, 200);
    assert.equal(logout.json().authenticated, false);
    assert.match(String(logout.headers["set-cookie"] ?? ""), /Max-Age=0/);
  } finally {
    await app.close();
    context.cleanup();
  }
});
