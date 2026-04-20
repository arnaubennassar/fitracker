import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  completePasskeyLogin: vi.fn(),
  completePasskeyRegistration: vi.fn(),
  replace: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("../providers", () => ({
  useSession: () => ({
    loading: false,
    session: {
      authenticated: false,
      session: null,
      user: null,
    },
    setSession: mocks.setSession,
  }),
}));

vi.mock("../_lib/api", () => {
  class ApiError extends Error {
    code: string | undefined;
    statusCode: number;

    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.code = code;
      this.name = "ApiError";
      this.statusCode = statusCode;
    }
  }

  return {
    ApiError,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock("../_lib/webauthn", () => ({
  completePasskeyLogin: mocks.completePasskeyLogin,
  completePasskeyRegistration: mocks.completePasskeyRegistration,
}));

describe("login page", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.completePasskeyLogin.mockReset();
    mocks.completePasskeyRegistration.mockReset();
    mocks.replace.mockReset();
    mocks.setSession.mockReset();
  });

  test("sign-in uses discoverable passkeys when athlete ID is blank", async () => {
    const user = userEvent.setup();
    const loginOptions = {
      challengeId: "challenge_login",
      publicKey: {
        allowCredentials: [],
        challenge: "challenge_data",
        rpId: "localhost",
        timeout: 60000,
        userVerification: "required" as const,
      },
    };
    const verificationPayload = {
      authenticatorData: "auth_data",
      challengeId: "challenge_login",
      clientDataJSON: "client_data",
      credentialId: "cred_1",
      signature: "signature_data",
    };
    const authSession = {
      authenticated: true,
      session: {
        expiresAt: "2026-04-20T10:00:00.000Z",
        id: "session_1",
        lastSeenAt: "2026-04-20T09:00:00.000Z",
      },
      user: {
        displayName: "Arnau",
        id: "user_arnau",
        status: "active",
      },
    };

    mocks.apiFetch
      .mockResolvedValueOnce(loginOptions)
      .mockResolvedValueOnce(authSession);
    mocks.completePasskeyLogin.mockResolvedValueOnce(verificationPayload);

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with passkey" }),
    );

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenNthCalledWith(
        1,
        "/auth/passkey/login/options",
        {
          bodyJson: {},
          method: "POST",
        },
      );
    });

    expect(mocks.completePasskeyLogin).toHaveBeenCalledWith(loginOptions);
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/auth/passkey/login/verify",
      {
        bodyJson: verificationPayload,
        method: "POST",
      },
    );
    expect(mocks.setSession).toHaveBeenCalledWith(authSession);
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  test("registration trims athlete details before requesting a passkey", async () => {
    const user = userEvent.setup();
    const registerOptions = {
      challengeId: "challenge_register",
      publicKey: {
        attestation: "none" as const,
        challenge: "challenge_data",
        excludeCredentials: [],
        pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
        rp: { id: "localhost", name: "Fitracker Test" },
        timeout: 60000,
        user: {
          displayName: "Nina",
          id: "user_nina",
          name: "user_nina",
        },
      },
    };
    const verificationPayload = {
      challengeId: "challenge_register",
      clientDataJSON: "client_data",
      credentialId: "cred_2",
      publicKey: "public_key_data",
      transports: ["internal"],
    };
    const authSession = {
      authenticated: true,
      session: {
        expiresAt: "2026-04-20T10:00:00.000Z",
        id: "session_2",
        lastSeenAt: "2026-04-20T09:00:00.000Z",
      },
      user: {
        displayName: "Nina",
        id: "user_nina",
        status: "active",
      },
    };

    mocks.apiFetch
      .mockResolvedValueOnce(registerOptions)
      .mockResolvedValueOnce(authSession);
    mocks.completePasskeyRegistration.mockResolvedValueOnce(
      verificationPayload,
    );

    render(<LoginPage />);

    await user.clear(screen.getByLabelText("Athlete ID"));
    await user.type(screen.getByLabelText("Athlete ID"), "  user_nina  ");
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "  Nina  ");
    await user.click(screen.getByRole("button", { name: "Create passkey" }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenNthCalledWith(
        1,
        "/auth/passkey/register/options",
        {
          bodyJson: {
            displayName: "Nina",
            userId: "user_nina",
          },
          method: "POST",
        },
      );
    });

    expect(mocks.completePasskeyRegistration).toHaveBeenCalledWith(
      registerOptions,
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/auth/passkey/register/verify",
      {
        bodyJson: verificationPayload,
        method: "POST",
      },
    );
    expect(mocks.setSession).toHaveBeenCalledWith(authSession);
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });
});
