"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useEffect, useState } from "react";

import { ApiError, apiFetch, getPasskeyStatus } from "../_lib/api";
import type { AuthSession } from "../_lib/types";
import {
  completePasskeyLogin,
  completePasskeyRegistration,
} from "../_lib/webauthn";
import { useSession } from "../providers";

function getAuthErrorMessage(error: unknown, fallbackMessage: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallbackMessage;
  }

  if (error.code === "PASSKEY_NOT_REGISTERED") {
    return "No passkey is registered yet on this app. Retry to create one on this device.";
  }

  if (error.code === "PASSKEY_ALREADY_REGISTERED") {
    return "A passkey is already registered. Retry to sign in with that passkey.";
  }

  return error.message;
}

export default function LoginPage() {
  const router = useRouter();
  const { loading, refreshSession, session, setSession } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<
    "checking" | "login" | "register"
  >("checking");

  useEffect(() => {
    if (!loading && session?.authenticated) {
      router.replace("/");
    }
  }, [loading, router, session]);

  useEffect(() => {
    if (attempt < 0) {
      return;
    }

    if (loading || session?.authenticated) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        setErrorMessage(null);
        setPendingMode("checking");

        const status = await getPasskeyStatus();

        if (cancelled) {
          return;
        }

        if (status.authenticated) {
          const authSession = await refreshSession();

          if (!cancelled && authSession?.authenticated) {
            router.replace("/");
          }
          return;
        }

        if (status.hasPasskey) {
          setPendingMode("login");
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

          if (cancelled) {
            return;
          }

          setSession(authSession);
          router.replace("/");
          return;
        }

        setPendingMode("register");
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

        if (cancelled) {
          return;
        }

        setSession(authSession);
        router.replace("/");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getAuthErrorMessage(error, "Passkey bootstrap failed."),
          );
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [attempt, loading, refreshSession, router, session, setSession]);

  const statusMessage =
    pendingMode === "checking"
      ? "Checking whether this app already has a passkey..."
      : pendingMode === "login"
        ? "Requesting the saved passkey for sign-in..."
        : "Creating the first passkey for this app on this device...";

  return (
    <div className="content-stack">
      <section className="panel-card">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Secure access</p>
            <h2 className="hero-title">Passkey bootstrap</h2>
          </div>
          <p className="hero-copy">{statusMessage}</p>
        </div>

        {errorMessage ? (
          <>
            <p className="error-banner">{errorMessage}</p>
            <button
              className="primary-button"
              onClick={() => {
                setAttempt((value) => value + 1);
              }}
              type="button"
            >
              Retry
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
