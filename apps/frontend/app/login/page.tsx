"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "../_lib/api";
import type { AuthSession } from "../_lib/types";
import {
  completePasskeyLogin,
  completePasskeyRegistration,
} from "../_lib/webauthn";
import { useSession } from "../providers";

const defaultProfile = {
  displayName: "Arnau",
  userId: "user_arnau",
};

function normalizeFieldValue(value: string) {
  return value.trim();
}

function getAuthErrorMessage(
  error: unknown,
  fallbackMessage: string,
  mode: "login" | "register",
) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallbackMessage;
  }

  if (
    mode === "login" &&
    (error.code === "USER_NOT_FOUND" || error.code === "PASSKEY_NOT_REGISTERED")
  ) {
    return "No saved passkey is registered for that athlete yet. Use Create passkey on this device first.";
  }

  if (mode === "register" && error.code === "PASSKEY_ALREADY_REGISTERED") {
    return "This passkey is already registered. Use Sign in with passkey instead.";
  }

  return error.message;
}

export default function LoginPage() {
  const router = useRouter();
  const { loading, session, setSession } = useSession();
  const [loginUserId, setLoginUserId] = useState("");
  const [registerUserId, setRegisterUserId] = useState(defaultProfile.userId);
  const [displayName, setDisplayName] = useState(defaultProfile.displayName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"login" | "register" | null>(
    null,
  );

  useEffect(() => {
    if (!loading && session?.authenticated) {
      router.replace("/");
    }
  }, [loading, router, session]);

  async function handleLogin() {
    setPendingMode("login");
    setErrorMessage(null);

    try {
      const trimmedUserId = normalizeFieldValue(loginUserId);
      const options = await apiFetch<{
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
      }>("/auth/passkey/login/options", {
        bodyJson: trimmedUserId ? { userId: trimmedUserId } : {},
        method: "POST",
      });
      const verificationPayload = await completePasskeyLogin(options);
      const authSession = await apiFetch<AuthSession>(
        "/auth/passkey/login/verify",
        {
          bodyJson: verificationPayload,
          method: "POST",
        },
      );

      setSession(authSession);
      router.replace("/");
    } catch (error) {
      setErrorMessage(
        getAuthErrorMessage(error, "Passkey sign-in failed.", "login"),
      );
    } finally {
      setPendingMode(null);
    }
  }

  async function handleRegister() {
    setPendingMode("register");
    setErrorMessage(null);

    try {
      const trimmedUserId = normalizeFieldValue(registerUserId);
      const trimmedDisplayName = normalizeFieldValue(displayName);

      if (!trimmedUserId || !trimmedDisplayName) {
        throw new Error(
          "Athlete ID and display name are required to create a passkey.",
        );
      }

      const options = await apiFetch<{
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
      }>("/auth/passkey/register/options", {
        bodyJson: {
          displayName: trimmedDisplayName,
          userId: trimmedUserId,
        },
        method: "POST",
      });
      const verificationPayload = await completePasskeyRegistration(options);
      const authSession = await apiFetch<AuthSession>(
        "/auth/passkey/register/verify",
        {
          bodyJson: verificationPayload,
          method: "POST",
        },
      );

      setSession(authSession);
      router.replace("/");
    } catch (error) {
      setErrorMessage(
        getAuthErrorMessage(error, "Passkey setup failed.", "register"),
      );
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <div className="content-stack">
      <section className="hero-card">
        <p className="eyebrow">Passkey</p>
        <h2 className="hero-title">Make sign-in feel predictable</h2>
        <p className="hero-copy">
          Sign in with a passkey that already lives on this device, or create
          one as a one-time setup step for a specific athlete profile.
        </p>
      </section>

      <section className="panel-card">
        <div className="auth-flow-grid">
          <section className="auth-flow-card">
            <div className="auth-flow-copy">
              <p className="section-label">Sign In</p>
              <h3>Use a saved passkey</h3>
              <p className="helper-copy">
                Leave athlete ID blank to let the browser offer available
                passkeys. Add it only if you need to narrow sign-in to one
                athlete.
              </p>
            </div>
            <label className="field">
              <span>Athlete ID (optional)</span>
              <input
                autoComplete="username webauthn"
                onChange={(event) => setLoginUserId(event.target.value)}
                placeholder="user_arnau"
                value={loginUserId}
              />
            </label>
            <button
              className="primary-button full-width"
              disabled={pendingMode !== null}
              onClick={() => {
                void handleLogin();
              }}
              type="button"
            >
              {pendingMode === "login"
                ? "Waiting for passkey..."
                : "Sign in with passkey"}
            </button>
          </section>

          <section className="auth-flow-card auth-flow-card-accent">
            <div className="auth-flow-copy">
              <p className="section-label">First Time Here?</p>
              <h3>Create a passkey on this device</h3>
              <p className="helper-copy">
                Use this once per device or browser profile. After setup, return
                to the sign-in action and the browser can recognize the passkey
                directly.
              </p>
            </div>
            <div className="field-grid compact-field-grid">
              <label className="field">
                <span>Athlete ID</span>
                <input
                  autoComplete="username"
                  onChange={(event) => setRegisterUserId(event.target.value)}
                  value={registerUserId}
                />
              </label>
              <label className="field">
                <span>Display name</span>
                <input
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </label>
            </div>
            <button
              className="secondary-button full-width"
              disabled={pendingMode !== null}
              onClick={() => {
                void handleRegister();
              }}
              type="button"
            >
              {pendingMode === "register"
                ? "Creating passkey..."
                : "Create passkey"}
            </button>
            <p className="helper-copy">
              Seeded local athlete: <code>{defaultProfile.userId}</code>.
            </p>
          </section>
        </div>
        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        <p className="helper-copy">
          If sign-in reports that no passkey is available, finish the device
          setup step first and then retry sign-in.
        </p>
      </section>
    </div>
  );
}
