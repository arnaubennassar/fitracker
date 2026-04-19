"use client";

import { useState } from "react";

import { env } from "../env";

type Status = {
  kind: "error" | "idle" | "info" | "success";
  message: string;
};

const INITIAL_STATUS: Status = {
  kind: "idle",
  message: "Passkeys keep sign-in fast and password-free.",
};

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const binary = atob(normalized + "=".repeat(padLength));
  const buffer = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    buffer[index] = binary.charCodeAt(index);
  }
  return buffer.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function utf8Encode(value: string) {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

async function postJson<T>(path: string, body: unknown) {
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Request to ${path} failed.`);
  }

  return (await response.json()) as T;
}

type RegisterOptionsResponse = {
  challengeId: string;
  publicKey: {
    challenge: string;
    rp: { id: string; name: string };
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: Array<{ alg: number; type: "public-key" }>;
    timeout: number;
    attestation: "none";
    authenticatorSelection: {
      residentKey: "preferred";
      userVerification: "preferred";
    };
    excludeCredentials: Array<{
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransport[];
    }>;
  };
};

type LoginOptionsResponse = {
  challengeId: string;
  publicKey: {
    challenge: string;
    rpId: string;
    timeout: number;
    userVerification: "required";
    allowCredentials: Array<{
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransport[];
    }>;
  };
};

export function PasskeyLoginForm() {
  const [userId, setUserId] = useState("user_arnau");
  const [displayName, setDisplayName] = useState("Arnau");
  const [status, setStatus] = useState<Status>(INITIAL_STATUS);

  async function handleRegister() {
    try {
      setStatus({
        kind: "info",
        message: "Asking the device for a new passkey…",
      });

      const options = await postJson<RegisterOptionsResponse>(
        "/auth/passkey/register/options",
        { userId, displayName },
      );

      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options.publicKey,
        challenge: base64UrlToBuffer(options.publicKey.challenge),
        user: {
          ...options.publicKey.user,
          id: utf8Encode(options.publicKey.user.id),
        },
        excludeCredentials: options.publicKey.excludeCredentials.map(
          (credential) => ({
            ...credential,
            id: base64UrlToBuffer(credential.id),
          }),
        ),
      };

      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("No credential returned by the authenticator.");
      }

      const attestationResponse =
        credential.response as AuthenticatorAttestationResponse;
      const spkiPublicKey = attestationResponse.getPublicKey?.();

      if (!spkiPublicKey) {
        throw new Error("Authenticator did not expose the public key.");
      }

      const verify = await postJson<{ authenticated: boolean }>(
        "/auth/passkey/register/verify",
        {
          challengeId: options.challengeId,
          credentialId: bufferToBase64Url(credential.rawId),
          clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
          publicKey: bufferToBase64Url(spkiPublicKey),
          transports: attestationResponse.getTransports?.() ?? ["internal"],
        },
      );

      setStatus({
        kind: verify.authenticated ? "success" : "error",
        message: verify.authenticated
          ? "Passkey registered. You are signed in."
          : "Registration could not be verified.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected error while registering passkey.",
      });
    }
  }

  async function handleLogin() {
    try {
      setStatus({
        kind: "info",
        message: "Asking the device for a passkey…",
      });

      const options = await postJson<LoginOptionsResponse>(
        "/auth/passkey/login/options",
        { userId },
      );

      const publicKey: PublicKeyCredentialRequestOptions = {
        ...options.publicKey,
        challenge: base64UrlToBuffer(options.publicKey.challenge),
        allowCredentials: options.publicKey.allowCredentials.map(
          (credential) => ({
            ...credential,
            id: base64UrlToBuffer(credential.id),
          }),
        ),
      };

      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("No credential returned by the authenticator.");
      }

      const assertion = credential.response as AuthenticatorAssertionResponse;

      const verify = await postJson<{ authenticated: boolean }>(
        "/auth/passkey/login/verify",
        {
          challengeId: options.challengeId,
          credentialId: bufferToBase64Url(credential.rawId),
          authenticatorData: bufferToBase64Url(assertion.authenticatorData),
          clientDataJSON: bufferToBase64Url(assertion.clientDataJSON),
          signature: bufferToBase64Url(assertion.signature),
        },
      );

      setStatus({
        kind: verify.authenticated ? "success" : "error",
        message: verify.authenticated
          ? "Signed in. Workouts are ready."
          : "The authenticator response could not be verified.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected error while signing in with passkey.",
      });
    }
  }

  return (
    <section className="panel" aria-label="Passkey sign-in">
      <form
        className="card-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void handleLogin();
        }}
      >
        <label className="card" htmlFor="user-id">
          <span className="section-label">User ID</span>
          <input
            id="user-id"
            name="user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
            required
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.65rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
            }}
          />
        </label>

        <label className="card" htmlFor="display-name">
          <span className="section-label">Display name</span>
          <input
            id="display-name"
            name="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            required
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.65rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
            }}
          />
        </label>

        <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
          <button type="submit" className="status-pill">
            Sign in with passkey
          </button>
          <button
            type="button"
            className="status-pill"
            onClick={() => {
              void handleRegister();
            }}
            style={{
              background: "rgba(12, 107, 88, 0.12)",
              color: "var(--accent)",
            }}
          >
            Register a new passkey
          </button>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            {status.message}
          </p>
        </div>
      </form>
    </section>
  );
}
