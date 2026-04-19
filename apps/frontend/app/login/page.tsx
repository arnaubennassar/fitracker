"use client";

import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
  const { loading, session, setSession } = useSession();
  const [userId, setUserId] = useState(defaultProfile.userId);
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
        bodyJson: { userId },
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
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Passkey sign-in failed.",
      );
    } finally {
      setPendingMode(null);
    }
  }

  async function handleRegister() {
    setPendingMode("register");
    setErrorMessage(null);

    try {
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
        bodyJson: { displayName, userId },
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
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Passkey setup failed.",
      );
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <div className="content-stack">
      <section className="hero-card">
        <p className="eyebrow">Passkey</p>
        <h2 className="hero-title">Use the device you train with</h2>
        <p className="hero-copy">
          Sign in with a saved passkey, or register one on this device for the
          seeded local athlete profile.
        </p>
      </section>

      <section className="panel-card">
        <div className="field-grid">
          <label className="field">
            <span>User ID</span>
            <input
              onChange={(event) => setUserId(event.target.value)}
              value={userId}
            />
          </label>
          <label className="field">
            <span>Display name</span>
            <input
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
        </div>
        <div className="action-row">
          <button
            className="primary-button"
            disabled={pendingMode !== null}
            onClick={() => {
              void handleLogin();
            }}
            type="button"
          >
            {pendingMode === "login" ? "Signing in..." : "Sign in"}
          </button>
          <button
            className="secondary-button"
            disabled={pendingMode !== null}
            onClick={() => {
              void handleRegister();
            }}
            type="button"
          >
            {pendingMode === "register" ? "Registering..." : "Register passkey"}
          </button>
        </div>
        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        <p className="helper-copy">
          Local seeded user: <code>user_arnau</code>. Registration is required
          once per device before passkey sign-in works.
        </p>
      </section>
    </div>
  );
}
