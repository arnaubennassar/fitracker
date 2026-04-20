import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildWorkoutFeedback,
  buildWorkoutSession,
  buildWorkoutSessionListResponse,
} from "../../test/fixtures";
import HistoryPage from "./page";

const mocks = vi.hoisted(() => ({
  listWorkoutSessions: vi.fn(),
  replace: vi.fn(),
  session: null as
    | ReturnType<typeof buildAuthSession>
    | {
        authenticated: false;
        session: null;
      }
    | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("../providers", () => ({
  useSession: () => ({
    loading: false,
    session: mocks.session,
  }),
}));

vi.mock("../_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_lib/api")>();

  return {
    ...actual,
    listWorkoutSessions: mocks.listWorkoutSessions,
  };
});

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("../_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("history page", () => {
  beforeEach(() => {
    mocks.listWorkoutSessions.mockReset();
    mocks.replace.mockReset();
    mocks.session = buildAuthSession();
  });

  test("redirects unauthenticated athletes to login", async () => {
    mocks.session = {
      authenticated: false,
      session: null,
    };

    render(<HistoryPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login");
    });
  });

  test("renders the empty state when there is no history", async () => {
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );

    render(<HistoryPage />);

    expect(
      await screen.findByRole("heading", { name: "No history yet" }),
    ).toBeVisible();
  });

  test("shows in-progress and completed sessions with the correct CTAs", async () => {
    const inProgress = buildWorkoutSession({ id: "session_live" });
    const completedWithoutFeedback = buildWorkoutSession({
      completedAt: "2026-04-20T10:00:00.000Z",
      durationSeconds: 1800,
      feedback: null,
      id: "session_done",
      status: "completed",
    });
    const completedWithFeedback = buildWorkoutSession({
      completedAt: "2026-04-19T10:00:00.000Z",
      durationSeconds: 1700,
      feedback: buildWorkoutFeedback(),
      id: "session_done_feedback",
      status: "completed",
    });

    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([
        inProgress,
        completedWithoutFeedback,
        completedWithFeedback,
      ]),
    );

    render(<HistoryPage />);

    expect(await screen.findByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      "/sessions/session_live",
    );
    expect(screen.getAllByText("Foundation Session A").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("link", { name: "Add feedback" })).toHaveAttribute(
      "href",
      "/sessions/session_done/feedback",
    );
    expect(screen.getByText("Felt steady.")).toBeVisible();
  });

  test("shows the load error banner when history fails", async () => {
    mocks.listWorkoutSessions.mockRejectedValueOnce(
      await createApiError("Could not load history.", 500),
    );

    render(<HistoryPage />);

    expect(await screen.findByText("Could not load history.")).toBeVisible();
  });
});
