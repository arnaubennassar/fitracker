import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildAuthSession } from "../test/fixtures";
import { AppProviders, useSession } from "./providers";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  logoutUser: vi.fn(),
}));

vi.mock("./_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_lib/api")>();

  return {
    ...actual,
    getAuthSession: mocks.getAuthSession,
    logoutUser: mocks.logoutUser,
  };
});

function SessionConsumer() {
  const {
    errorMessage,
    loading,
    refreshSession,
    session,
    setSession,
    signOut,
  } = useSession();

  return (
    <div>
      <p>{loading ? "loading" : "ready"}</p>
      <p>{errorMessage ?? "no-error"}</p>
      <p>{session?.user?.id ?? "no-session"}</p>
      <button
        onClick={() => {
          setSession(
            buildAuthSession({
              user: {
                displayName: "Manual User",
                id: "user_manual",
                status: "active",
              },
            }),
          );
        }}
        type="button"
      >
        Set session
      </button>
      <button
        onClick={() => {
          void refreshSession();
        }}
        type="button"
      >
        Refresh session
      </button>
      <button
        onClick={() => {
          void signOut();
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function renderProviders() {
  return render(
    <AppProviders>
      <SessionConsumer />
    </AppProviders>,
  );
}

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("./_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("app providers", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.logoutUser.mockReset();
  });

  test("loads the auth session on mount", async () => {
    mocks.getAuthSession.mockResolvedValueOnce(buildAuthSession());

    renderProviders();

    expect(await screen.findByText("user_arnau")).toBeVisible();
    expect(screen.getByText("ready")).toBeVisible();
    expect(mocks.getAuthSession).toHaveBeenCalledTimes(1);
  });

  test("surfaces session load failures", async () => {
    mocks.getAuthSession.mockRejectedValueOnce(
      await createApiError("Could not load the session.", 500),
    );

    renderProviders();

    expect(
      await screen.findByText("Could not load the session."),
    ).toBeVisible();
    expect(screen.getByText("no-session")).toBeVisible();
    expect(screen.getByText("ready")).toBeVisible();
  });

  test("setSession wins over an in-flight refresh result", async () => {
    const user = userEvent.setup();
    const pending = deferredPromise<ReturnType<typeof buildAuthSession>>();

    mocks.getAuthSession.mockReturnValueOnce(pending.promise);

    renderProviders();

    await user.click(screen.getByRole("button", { name: "Set session" }));
    expect(screen.getByText("user_manual")).toBeVisible();
    expect(screen.getByText("ready")).toBeVisible();

    pending.resolve(buildAuthSession());

    await waitFor(() => {
      expect(screen.getByText("user_manual")).toBeVisible();
    });
    expect(screen.queryByText("user_arnau")).not.toBeInTheDocument();
  });

  test("signOut clears the session after calling logout", async () => {
    const user = userEvent.setup();

    mocks.getAuthSession.mockResolvedValueOnce(buildAuthSession());
    mocks.logoutUser.mockResolvedValueOnce({ authenticated: false });

    renderProviders();

    await screen.findByText("user_arnau");
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByText("no-session")).toBeVisible();
    });
    expect(mocks.logoutUser).toHaveBeenCalledTimes(1);
  });
});
