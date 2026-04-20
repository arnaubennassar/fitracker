import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  completePasskeyLogin,
  completePasskeyRegistration,
  encodeBase64Url,
} from "./webauthn";

class FakeAttestationResponse {
  clientDataJSON = new Uint8Array([1, 2, 3]).buffer;

  constructor(
    private readonly options: {
      publicKey?: ArrayBuffer | null;
      transports?: AuthenticatorTransport[];
    } = {},
  ) {}

  getPublicKey() {
    if ("publicKey" in this.options) {
      return this.options.publicKey ?? null;
    }

    return new Uint8Array([4, 5, 6]).buffer;
  }

  getTransports() {
    return this.options.transports ?? ["internal"];
  }
}

class FakeAssertionResponse {
  authenticatorData = new Uint8Array([7, 8, 9]).buffer;
  clientDataJSON = new Uint8Array([10, 11, 12]).buffer;
  signature = new Uint8Array([13, 14, 15]).buffer;
}

class FakePublicKeyCredential {
  constructor(
    public readonly id: string,
    public readonly response: unknown,
  ) {}
}

function bytesFrom(value: BufferSource) {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function setWebAuthnSupport({
  create,
  get,
  publicKeyCredential = FakePublicKeyCredential,
}: {
  create?: (options: CredentialCreationOptions) => Promise<unknown>;
  get?: (options: CredentialRequestOptions) => Promise<unknown>;
  publicKeyCredential?: unknown;
}) {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: publicKeyCredential,
  });
  Object.defineProperty(window, "AuthenticatorAttestationResponse", {
    configurable: true,
    value: FakeAttestationResponse,
  });
  Object.defineProperty(window, "AuthenticatorAssertionResponse", {
    configurable: true,
    value: FakeAssertionResponse,
  });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {
      create,
      get,
    },
  });
}

describe("webauthn helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setWebAuthnSupport({
      async create() {
        return null;
      },
      async get() {
        return null;
      },
    });
  });

  test("encodes binary values as base64url", () => {
    expect(encodeBase64Url(new Uint8Array([251, 255, 16]))).toBe("-_8Q");
  });

  test("builds a registration payload from navigator credentials", async () => {
    const create = vi.fn(async (options: CredentialCreationOptions) => {
      const publicKey = options.publicKey;

      if (!publicKey) {
        throw new Error("Expected public key creation options.");
      }

      expect(bytesFrom(publicKey.challenge)).toEqual(
        new Uint8Array([99, 104, 97, 108, 108, 101, 110, 103, 101]),
      );
      expect(new TextDecoder().decode(publicKey.user.id)).toBe("user_nina");
      expect(publicKey.excludeCredentials?.length).toBe(1);
      expect(
        bytesFrom(publicKey.excludeCredentials?.[0]?.id ?? new ArrayBuffer(0)),
      ).toEqual(new Uint8Array([99, 114, 101, 100]));

      return new FakePublicKeyCredential(
        "cred_registration",
        new FakeAttestationResponse(),
      );
    });

    setWebAuthnSupport({
      create,
      async get() {
        return null;
      },
    });

    await expect(
      completePasskeyRegistration({
        challengeId: "challenge_register",
        publicKey: {
          attestation: "none",
          challenge: "Y2hhbGxlbmdl",
          excludeCredentials: [
            {
              id: "Y3JlZA",
              transports: ["internal"],
              type: "public-key",
            },
          ],
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          rp: {
            id: "localhost",
            name: "Fitracker Test",
          },
          timeout: 60000,
          user: {
            displayName: "Nina",
            id: "dXNlcl9uaW5h",
            name: "user_nina",
          },
        },
      }),
    ).resolves.toEqual({
      challengeId: "challenge_register",
      clientDataJSON: "AQID",
      credentialId: "cred_registration",
      publicKey: "BAUG",
      transports: ["internal"],
    });
  });

  test("fails registration when the browser does not support passkeys", async () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: undefined,
    });

    await expect(
      completePasskeyRegistration({
        challengeId: "challenge_register",
        publicKey: {
          attestation: "none",
          challenge: "Y2hhbGxlbmdl",
          excludeCredentials: [],
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          rp: {
            id: "localhost",
            name: "Fitracker Test",
          },
          timeout: 60000,
          user: {
            displayName: "Nina",
            id: "dXNlcl9uaW5h",
            name: "user_nina",
          },
        },
      }),
    ).rejects.toThrow("This device does not support passkeys in the browser.");
  });

  test("fails registration when the authenticator cancels or omits the public key", async () => {
    setWebAuthnSupport({
      async create() {
        return null;
      },
      async get() {
        return null;
      },
    });

    await expect(
      completePasskeyRegistration({
        challengeId: "challenge_register",
        publicKey: {
          attestation: "none",
          challenge: "Y2hhbGxlbmdl",
          excludeCredentials: [],
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          rp: {
            id: "localhost",
            name: "Fitracker Test",
          },
          timeout: 60000,
          user: {
            displayName: "Nina",
            id: "dXNlcl9uaW5h",
            name: "user_nina",
          },
        },
      }),
    ).rejects.toThrow("Passkey registration was cancelled.");

    setWebAuthnSupport({
      async create() {
        return new FakePublicKeyCredential(
          "cred_registration",
          new FakeAttestationResponse({
            publicKey: null,
          }),
        );
      },
      async get() {
        return null;
      },
    });

    await expect(
      completePasskeyRegistration({
        challengeId: "challenge_register",
        publicKey: {
          attestation: "none",
          challenge: "Y2hhbGxlbmdl",
          excludeCredentials: [],
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          rp: {
            id: "localhost",
            name: "Fitracker Test",
          },
          timeout: 60000,
          user: {
            displayName: "Nina",
            id: "dXNlcl9uaW5h",
            name: "user_nina",
          },
        },
      }),
    ).rejects.toThrow(
      "This browser could not export the public key. Use a recent Chromium-based browser for local setup.",
    );
  });

  test("builds a login payload from navigator credentials", async () => {
    const get = vi.fn(async (options: CredentialRequestOptions) => {
      const publicKey = options.publicKey;

      if (!publicKey) {
        throw new Error("Expected public key request options.");
      }

      expect(bytesFrom(publicKey.challenge)).toEqual(
        new Uint8Array([99, 104, 97, 108, 108, 101, 110, 103, 101]),
      );
      expect(publicKey.allowCredentials?.length).toBe(1);
      expect(
        bytesFrom(publicKey.allowCredentials?.[0]?.id ?? new ArrayBuffer(0)),
      ).toEqual(new Uint8Array([99, 114, 101, 100]));

      return new FakePublicKeyCredential(
        "cred_login",
        new FakeAssertionResponse(),
      );
    });

    setWebAuthnSupport({
      async create() {
        return null;
      },
      get,
    });

    await expect(
      completePasskeyLogin({
        challengeId: "challenge_login",
        publicKey: {
          allowCredentials: [
            {
              id: "Y3JlZA",
              transports: ["internal"],
              type: "public-key",
            },
          ],
          challenge: "Y2hhbGxlbmdl",
          rpId: "localhost",
          timeout: 60000,
          userVerification: "required",
        },
      }),
    ).resolves.toEqual({
      authenticatorData: "BwgJ",
      challengeId: "challenge_login",
      clientDataJSON: "CgsM",
      credentialId: "cred_login",
      signature: "DQ4P",
    });
  });

  test("fails login when the credential flow is cancelled or malformed", async () => {
    setWebAuthnSupport({
      async create() {
        return null;
      },
      async get() {
        return null;
      },
    });

    await expect(
      completePasskeyLogin({
        challengeId: "challenge_login",
        publicKey: {
          allowCredentials: [],
          challenge: "Y2hhbGxlbmdl",
          rpId: "localhost",
          timeout: 60000,
          userVerification: "required",
        },
      }),
    ).rejects.toThrow("Passkey sign-in was cancelled.");

    setWebAuthnSupport({
      async create() {
        return null;
      },
      async get() {
        return new FakePublicKeyCredential(
          "cred_login",
          new FakeAttestationResponse(),
        );
      },
    });

    await expect(
      completePasskeyLogin({
        challengeId: "challenge_login",
        publicKey: {
          allowCredentials: [],
          challenge: "Y2hhbGxlbmdl",
          rpId: "localhost",
          timeout: 60000,
          userVerification: "required",
        },
      }),
    ).rejects.toThrow("Unexpected passkey login response.");
  });
});
