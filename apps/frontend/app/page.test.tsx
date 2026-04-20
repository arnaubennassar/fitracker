import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildTodayWorkoutsResponse,
  buildWorkoutSession,
  buildWorkoutSessionListResponse,
  buildWorkoutSet,
} from "../test/fixtures";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  getTodayWorkouts: vi.fn(),
  listWorkoutSessions: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  session: null as
    | ReturnType<typeof buildAuthSession>
    | {
        authenticated: false;
        session: null;
        user: null;
      }
    | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock("./providers", () => ({
  useSession: () => ({
    loading: false,
    session: mocks.session,
  }),
}));

vi.mock("./_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_lib/api")>();

  return {
    ...actual,
    getTodayWorkouts: mocks.getTodayWorkouts,
    listWorkoutSessions: mocks.listWorkoutSessions,
  };
});

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("./_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("home page", () => {
  beforeEach(() => {
    mocks.getTodayWorkouts.mockReset();
    mocks.listWorkoutSessions.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.session = buildAuthSession();
  });

  test("redirects unauthenticated athletes to login", async () => {
    mocks.session = {
      authenticated: false,
      session: null,
      user: null,
    };

    render(<HomePage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login");
    });
  });

  test("loads assigned workouts, active session, and recent history", async () => {
    const activeSession = buildWorkoutSession({ id: "session_live" });
    const completedSession = buildWorkoutSession({
      completedAt: "2026-04-20T10:00:00.000Z",
      durationSeconds: 1800,
      feedback: null,
      id: "session_done",
      sets: [buildWorkoutSet()],
      status: "completed",
    });

    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions
      .mockResolvedValueOnce(buildWorkoutSessionListResponse([activeSession]))
      .mockResolvedValueOnce(
        buildWorkoutSessionListResponse([activeSession, completedSession]),
      );

    render(<HomePage />);

    expect(
      await screen.findByRole("heading", { name: "Assigned workouts" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
    expect(screen.getAllByText("Foundation Session A").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("link", { name: "Open workout" })).toBeVisible();
    expect(mocks.listWorkoutSessions).toHaveBeenNthCalledWith(1, {
      limit: 1,
      status: "in_progress",
    });
    expect(mocks.listWorkoutSessions).toHaveBeenNthCalledWith(2, {
      limit: 5,
    });
  });

  test("shows an empty state when nothing is assigned today", async () => {
    mocks.getTodayWorkouts.mockResolvedValueOnce(
      buildTodayWorkoutsResponse({ items: [] }),
    );
    mocks.listWorkoutSessions
      .mockResolvedValueOnce(buildWorkoutSessionListResponse([]))
      .mockResolvedValueOnce(buildWorkoutSessionListResponse([]));

    render(<HomePage />);

    expect(
      await screen.findByRole("heading", {
        name: "No active assignment today",
      }),
    ).toBeVisible();
  });

  test("shows the load error banner when dashboard requests fail", async () => {
    mocks.getTodayWorkouts.mockRejectedValueOnce(
      await createApiError("Could not reach today.", 500),
    );
    mocks.listWorkoutSessions.mockResolvedValue(
      buildWorkoutSessionListResponse([]),
    );

    render(<HomePage />);

    expect(await screen.findByText("Could not reach today.")).toBeVisible();
  });

  test("resumes an active session from the dashboard card", async () => {
    const user = userEvent.setup();
    const activeSession = buildWorkoutSession({ id: "session_resume" });

    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions
      .mockResolvedValueOnce(buildWorkoutSessionListResponse([activeSession]))
      .mockResolvedValueOnce(buildWorkoutSessionListResponse([activeSession]));

    render(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Resume" }));

    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_resume");
  });
});
