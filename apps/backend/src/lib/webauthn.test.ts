import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthenticatorData,
  createTestAuthenticator,
  encodeClientDataJSON,
  signAssertion,
} from "../test-helpers.js";
import {
  createChallenge,
  decodeUtf8Base64Url,
  encodeBase64Url,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "./webauthn.js";

test("createChallenge and encode helpers round-trip base64url values", () => {
  const challenge = createChallenge();

  assert.equal(typeof challenge, "string");
  assert.ok(challenge.length > 20);
  assert.equal(
    decodeUtf8Base64Url(encodeBase64Url(Buffer.from("Arnau"))),
    "Arnau",
  );
});

test("verifyRegistrationResponse accepts valid client data", () => {
  const challenge = "challenge_register";
  const origin = "http://localhost:3000";

  assert.doesNotThrow(() =>
    verifyRegistrationResponse({
      clientDataJSON: encodeClientDataJSON({
        challenge,
        origin,
        type: "webauthn.create",
      }),
      expectedChallenge: challenge,
      expectedOrigin: origin,
    }),
  );
});

test("verifyRegistrationResponse rejects mismatched type, challenge, and origin", () => {
  assert.throws(
    () =>
      verifyRegistrationResponse({
        clientDataJSON: encodeClientDataJSON({
          challenge: "challenge_register",
          origin: "http://localhost:3000",
          type: "webauthn.get",
        }),
        expectedChallenge: "challenge_register",
        expectedOrigin: "http://localhost:3000",
      }),
    /Unexpected WebAuthn ceremony type/,
  );

  assert.throws(
    () =>
      verifyRegistrationResponse({
        clientDataJSON: encodeClientDataJSON({
          challenge: "wrong_challenge",
          origin: "http://localhost:3000",
          type: "webauthn.create",
        }),
        expectedChallenge: "challenge_register",
        expectedOrigin: "http://localhost:3000",
      }),
    /WebAuthn challenge mismatch/,
  );

  assert.throws(
    () =>
      verifyRegistrationResponse({
        clientDataJSON: encodeClientDataJSON({
          challenge: "challenge_register",
          origin: "http://127.0.0.1:3000",
          type: "webauthn.create",
        }),
        expectedChallenge: "challenge_register",
        expectedOrigin: "http://localhost:3000",
      }),
    /WebAuthn origin mismatch/,
  );
});

test("verifyAuthenticationResponse accepts a valid signed assertion", () => {
  const authenticator = createTestAuthenticator();
  const challenge = "challenge_login";
  const origin = "http://localhost:3000";
  const rpId = "localhost";
  const authenticatorData = buildAuthenticatorData(rpId, 1);
  const clientDataJSON = encodeClientDataJSON({
    challenge,
    origin,
    type: "webauthn.get",
  });
  const signature = signAssertion(
    authenticator.privateKey,
    authenticatorData,
    clientDataJSON,
  );

  const verified = verifyAuthenticationResponse({
    authenticatorData: authenticatorData.toString("base64url"),
    clientDataJSON,
    currentCounter: 0,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRpId: rpId,
    publicKey: authenticator.publicKeyBase64Url,
    signature: signature.toString("base64url"),
  });

  assert.equal(verified.counter, 1);
});

test("verifyAuthenticationResponse rejects invalid RP IDs, flags, counters, and signatures", () => {
  const authenticator = createTestAuthenticator();
  const challenge = "challenge_login";
  const origin = "http://localhost:3000";
  const rpId = "localhost";
  const clientDataJSON = encodeClientDataJSON({
    challenge,
    origin,
    type: "webauthn.get",
  });

  const wrongRpAuthenticatorData = buildAuthenticatorData("example.com", 1);
  const wrongRpSignature = signAssertion(
    authenticator.privateKey,
    wrongRpAuthenticatorData,
    clientDataJSON,
  );
  assert.throws(
    () =>
      verifyAuthenticationResponse({
        authenticatorData: wrongRpAuthenticatorData.toString("base64url"),
        clientDataJSON,
        currentCounter: 0,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        publicKey: authenticator.publicKeyBase64Url,
        signature: wrongRpSignature.toString("base64url"),
      }),
    /Authenticator RP ID hash mismatch/,
  );

  const missingPresenceData = Buffer.concat([
    authenticatorDataPrefix(rpId),
    Buffer.from([0x04]),
    counterBuffer(1),
  ]);
  const missingPresenceSignature = signAssertion(
    authenticator.privateKey,
    missingPresenceData,
    clientDataJSON,
  );
  assert.throws(
    () =>
      verifyAuthenticationResponse({
        authenticatorData: missingPresenceData.toString("base64url"),
        clientDataJSON,
        currentCounter: 0,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        publicKey: authenticator.publicKeyBase64Url,
        signature: missingPresenceSignature.toString("base64url"),
      }),
    /credential as present/,
  );

  const missingVerificationData = Buffer.concat([
    authenticatorDataPrefix(rpId),
    Buffer.from([0x01]),
    counterBuffer(1),
  ]);
  const missingVerificationSignature = signAssertion(
    authenticator.privateKey,
    missingVerificationData,
    clientDataJSON,
  );
  assert.throws(
    () =>
      verifyAuthenticationResponse({
        authenticatorData: missingVerificationData.toString("base64url"),
        clientDataJSON,
        currentCounter: 0,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        publicKey: authenticator.publicKeyBase64Url,
        signature: missingVerificationSignature.toString("base64url"),
      }),
    /did not verify the user/,
  );

  const staleCounterData = buildAuthenticatorData(rpId, 1);
  const staleCounterSignature = signAssertion(
    authenticator.privateKey,
    staleCounterData,
    clientDataJSON,
  );
  assert.throws(
    () =>
      verifyAuthenticationResponse({
        authenticatorData: staleCounterData.toString("base64url"),
        clientDataJSON,
        currentCounter: 1,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        publicKey: authenticator.publicKeyBase64Url,
        signature: staleCounterSignature.toString("base64url"),
      }),
    /counter did not increase/,
  );

  const validAuthenticatorData = buildAuthenticatorData(rpId, 2);
  assert.throws(
    () =>
      verifyAuthenticationResponse({
        authenticatorData: validAuthenticatorData.toString("base64url"),
        clientDataJSON,
        currentCounter: 0,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        publicKey: authenticator.publicKeyBase64Url,
        signature: Buffer.from("bad").toString("base64url"),
      }),
    /signature verification failed/,
  );
});

function authenticatorDataPrefix(rpId: string) {
  return buildAuthenticatorData(rpId, 1).subarray(0, 32);
}

function counterBuffer(counter: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(counter, 0);
  return buffer;
}
