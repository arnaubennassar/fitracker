import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

type ClientData = {
  challenge: string;
  crossOrigin?: boolean;
  origin: string;
  type: string;
};

type VerifyRegistrationOptions = {
  clientDataJSON: string;
  expectedChallenge: string;
  expectedOrigin: string;
};

type VerifyAuthenticationOptions = {
  authenticatorData: string;
  clientDataJSON: string;
  currentCounter: number;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  publicKey: string;
  signature: string;
};

function timingSafeEqualString(a: string, b: string) {
  return a.length === b.length && Buffer.from(a).equals(Buffer.from(b));
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function decodeClientDataJSON(value: string) {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as ClientData;
}

function assertExpectedClientData(
  clientData: ClientData,
  expected: {
    challenge: string;
    origin: string;
    type: "webauthn.create" | "webauthn.get";
  },
) {
  if (!timingSafeEqualString(clientData.type, expected.type)) {
    throw new Error(`Unexpected WebAuthn ceremony type: ${clientData.type}`);
  }

  if (!timingSafeEqualString(clientData.challenge, expected.challenge)) {
    throw new Error("WebAuthn challenge mismatch.");
  }

  if (!timingSafeEqualString(clientData.origin, expected.origin)) {
    throw new Error("WebAuthn origin mismatch.");
  }
}

function parseAuthenticatorData(value: string) {
  const authenticatorData = decodeBase64Url(value);

  if (authenticatorData.byteLength < 37) {
    throw new Error("Authenticator data is too short.");
  }

  return {
    buffer: authenticatorData,
    counter: authenticatorData.readUInt32BE(33),
    flags: authenticatorData[32] ?? 0,
    rpIdHash: authenticatorData.subarray(0, 32),
  };
}

export function createChallenge() {
  return randomBytes(32).toString("base64url");
}

export function encodeBase64Url(value: ArrayBuffer | Buffer | Uint8Array) {
  return Buffer.from(
    value instanceof ArrayBuffer ? new Uint8Array(value) : value,
  ).toString("base64url");
}

export function decodeUtf8Base64Url(value: string) {
  return decodeBase64Url(value).toString("utf8");
}

export function verifyRegistrationResponse({
  clientDataJSON,
  expectedChallenge,
  expectedOrigin,
}: VerifyRegistrationOptions) {
  const clientData = decodeClientDataJSON(clientDataJSON);

  assertExpectedClientData(clientData, {
    challenge: expectedChallenge,
    origin: expectedOrigin,
    type: "webauthn.create",
  });
}

export function verifyAuthenticationResponse({
  authenticatorData,
  clientDataJSON,
  currentCounter,
  expectedChallenge,
  expectedOrigin,
  expectedRpId,
  publicKey,
  signature,
}: VerifyAuthenticationOptions) {
  const clientData = decodeClientDataJSON(clientDataJSON);

  assertExpectedClientData(clientData, {
    challenge: expectedChallenge,
    origin: expectedOrigin,
    type: "webauthn.get",
  });

  const parsedAuthenticatorData = parseAuthenticatorData(authenticatorData);
  const expectedRpIdHash = createHash("sha256").update(expectedRpId).digest();

  if (!parsedAuthenticatorData.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error("Authenticator RP ID hash mismatch.");
  }

  if ((parsedAuthenticatorData.flags & 0x01) === 0) {
    throw new Error("Authenticator did not mark the credential as present.");
  }

  if ((parsedAuthenticatorData.flags & 0x04) === 0) {
    throw new Error("Authenticator did not verify the user.");
  }

  if (
    currentCounter > 0 &&
    parsedAuthenticatorData.counter > 0 &&
    parsedAuthenticatorData.counter <= currentCounter
  ) {
    throw new Error("Authenticator counter did not increase.");
  }

  const clientDataHash = createHash("sha256")
    .update(decodeBase64Url(clientDataJSON))
    .digest();
  const signatureBase = Buffer.concat([
    parsedAuthenticatorData.buffer,
    clientDataHash,
  ]);

  const isValidSignature = verify(
    "sha256",
    signatureBase,
    createPublicKey({
      format: "der",
      key: decodeBase64Url(publicKey),
      type: "spki",
    }),
    decodeBase64Url(signature),
  );

  if (!isValidSignature) {
    throw new Error("WebAuthn signature verification failed.");
  }

  return {
    counter: parsedAuthenticatorData.counter,
  };
}
