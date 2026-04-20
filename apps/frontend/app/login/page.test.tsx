import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildAuthSession } from "../../test/fixtures";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  completePasskeyLogin: vi.fn(),
  completePasskeyRegistration: vi.fn(),
  getPasskeyStatus: vi.fn(),
  refreshSession: vi.fn(),
  replace: vi.fn(),
  session: null as
    | ReturnType<typeof buildAuthSession>
    | {
        authenticated: false;
        session: null;
      }
    | null,
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
    refreshSession: mocks.refreshSession,
    session: mocks.session,
    setSession: mocks.setSession,
  }),
}));

vi.mock("../_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_lib/api")>();

  return {
    ...actual,
    apiFetch: mocks.apiFetch,
    getPasskeyStatus: mocks.getPasskeyStatus,
  };
});

vi.mock("../_lib/webauthn", () => ({
  completePasskeyLogin: mocks.completePasskeyLogin,
  completePasskeyRegistration: mocks.completePasskeyRegistration,
}));

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("../_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("login page", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.completePasskeyLogin.mockReset();
    mocks.completePasskeyRegistration.mockReset();
    mocks.getPasskeyStatus.mockReset();
    mocks.refreshSession.mockReset();
    mocks.replace.mockReset();
    mocks.setSession.mockReset();
    mocks.session = {
      authenticated: false,
      session: null,
    };
    mocks.getPasskeyStatus.mockResolvedValue({
      authenticated: false,
      hasPasskey: true,
    });
    mocks.refreshSession.mockResolvedValue(null);
  });

  test("redirects authenticated sessions back to the dashboard", async () => {
    mocks.session = buildAuthSession();

    render(<LoginPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/");
    });
  });

  test("bootstraps passkey login when a passkey already exists", async () => {
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
    const authSession = buildAuthSession();

    mocks.apiFetch
      .mockResolvedValueOnce(loginOptions)
      .mockResolvedValueOnce(authSession);
    mocks.completePasskeyLogin.mockResolvedValueOnce(verificationPayload);

    render(<LoginPage />);

    expect(
      await screen.findByText("Requesting the saved passkey for sign-in..."),
    ).toBeVisible();

    await waitFor(() => {
      expect(mocks.getPasskeyStatus).toHaveBeenCalled();
      expect(mocks.apiFetch).toHaveBeenNthCalledWith(
        1,
        "/auth/passkey/login/options",
        {
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

  test("bootstraps passkey registration when no passkey exists yet", async () => {
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
          displayName: "Fitracker athlete",
          id: "Zml0cmFja2VyLWF0aGxldGU",
          name: "athlete",
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
    const authSession = buildAuthSession();

    mocks.getPasskeyStatus.mockResolvedValueOnce({
      authenticated: false,
      hasPasskey: false,
    });
    mocks.apiFetch
      .mockResolvedValueOnce(registerOptions)
      .mockResolvedValueOnce(authSession);
    mocks.completePasskeyRegistration.mockResolvedValueOnce(
      verificationPayload,
    );

    render(<LoginPage />);

    expect(
      await screen.findByText(
        "Creating the first passkey for this app on this device...",
      ),
    ).toBeVisible();

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenNthCalledWith(
        1,
        "/auth/passkey/register/options",
        {
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

  test("refreshes the full auth session when passkey status says already authenticated", async () => {
    const authSession = buildAuthSession();

    mocks.getPasskeyStatus.mockResolvedValueOnce({
      authenticated: true,
      hasPasskey: true,
    });
    mocks.refreshSession.mockResolvedValueOnce(authSession);

    render(<LoginPage />);

    await waitFor(() => {
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/");
    });

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  test("shows the mapped bootstrap error and retries", async () => {
    const user = userEvent.setup();
    const missingPasskeyError = await createApiError(
      "No passkey",
      404,
      "PASSKEY_NOT_REGISTERED",
    );

    mocks.getPasskeyStatus
      .mockRejectedValueOnce(missingPasskeyError)
      .mockRejectedValueOnce(missingPasskeyError)
      .mockResolvedValue({
        authenticated: false,
        hasPasskey: true,
      });
    mocks.apiFetch
      .mockResolvedValueOnce({
        challengeId: "challenge_login",
        publicKey: {
          allowCredentials: [],
          challenge: "challenge_data",
          rpId: "localhost",
          timeout: 60000,
          userVerification: "required" as const,
        },
      })
      .mockResolvedValueOnce(buildAuthSession());
    mocks.completePasskeyLogin.mockResolvedValueOnce({
      authenticatorData: "auth_data",
      challengeId: "challenge_login",
      clientDataJSON: "client_data",
      credentialId: "cred_1",
      signature: "signature_data",
    });

    render(<LoginPage />);

    expect(
      await screen.findByText(
        "No passkey is registered yet on this app. Retry to create one on this device.",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mocks.getPasskeyStatus.mock.calls.length).toBeGreaterThanOrEqual(
        2,
      );
    });
  });
});
