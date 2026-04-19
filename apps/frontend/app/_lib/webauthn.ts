type RegisterOptionsResponse = {
  challengeId: string;
  publicKey: {
    attestation: "none";
    authenticatorSelection?: PublicKeyCredentialCreationOptions["authenticatorSelection"];
    challenge: string;
    excludeCredentials: Array<{
      id: string;
      transports?: AuthenticatorTransport[];
      type: "public-key";
    }>;
    pubKeyCredParams: PublicKeyCredentialParameters[];
    rp: PublicKeyCredentialRpEntity;
    timeout: number;
    user: {
      displayName: string;
      id: string;
      name: string;
    };
  };
};

type LoginOptionsResponse = {
  challengeId: string;
  publicKey: {
    allowCredentials: Array<{
      id: string;
      transports?: AuthenticatorTransport[];
      type: "public-key";
    }>;
    challenge: string;
    rpId: string;
    timeout: number;
    userVerification: UserVerificationRequirement;
  };
};

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function encodeBase64Url(value: ArrayBuffer | ArrayBufferView) {
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let text = "";

  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }

  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function ensureWebAuthnSupport() {
  if (
    typeof window === "undefined" ||
    typeof window.PublicKeyCredential === "undefined" ||
    typeof navigator.credentials === "undefined"
  ) {
    throw new Error("This device does not support passkeys in the browser.");
  }
}

export async function completePasskeyRegistration(
  options: RegisterOptionsResponse,
) {
  ensureWebAuthnSupport();
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    attestation: options.publicKey.attestation,
    challenge: decodeBase64Url(options.publicKey.challenge),
    excludeCredentials: options.publicKey.excludeCredentials.map((item) => ({
      ...item,
      id: decodeBase64Url(item.id),
    })),
    pubKeyCredParams: options.publicKey.pubKeyCredParams,
    rp: options.publicKey.rp,
    timeout: options.publicKey.timeout,
    user: {
      ...options.publicKey.user,
      id: decodeBase64Url(options.publicKey.user.id),
    },
  };

  if (options.publicKey.authenticatorSelection) {
    publicKeyOptions.authenticatorSelection =
      options.publicKey.authenticatorSelection;
  }

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey registration was cancelled.");
  }

  const response = credential.response;

  if (!(response instanceof AuthenticatorAttestationResponse)) {
    throw new Error("Unexpected passkey registration response.");
  }

  const transports =
    typeof response.getTransports === "function"
      ? response.getTransports()
      : [];
  const publicKey = response.getPublicKey?.();

  if (!publicKey) {
    throw new Error(
      "This browser could not export the public key. Use a recent Chromium-based browser for local setup.",
    );
  }

  return {
    challengeId: options.challengeId,
    clientDataJSON: encodeBase64Url(response.clientDataJSON),
    credentialId: credential.id,
    publicKey: encodeBase64Url(publicKey),
    transports,
  };
}

export async function completePasskeyLogin(options: LoginOptionsResponse) {
  ensureWebAuthnSupport();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      ...options.publicKey,
      allowCredentials: options.publicKey.allowCredentials.map((item) => ({
        ...item,
        id: decodeBase64Url(item.id),
      })),
      challenge: decodeBase64Url(options.publicKey.challenge),
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Passkey sign-in was cancelled.");
  }

  const response = assertion.response;

  if (!(response instanceof AuthenticatorAssertionResponse)) {
    throw new Error("Unexpected passkey login response.");
  }

  return {
    authenticatorData: encodeBase64Url(response.authenticatorData),
    challengeId: options.challengeId,
    clientDataJSON: encodeBase64Url(response.clientDataJSON),
    credentialId: assertion.id,
    signature: encodeBase64Url(response.signature),
  };
}
