import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildTodayWorkoutsResponse,
  buildWorkoutSession,
  buildWorkoutSessionListResponse,
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
    };

    render(<HomePage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login");
    });
  });

  test("loads assigned workouts and shows the active session inside the list", async () => {
    const activeSession = buildWorkoutSession({ id: "session_live" });

    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([activeSession]),
    );

    render(<HomePage />);

    expect(
      await screen.findByRole("heading", { name: "Assigned workouts" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
    expect(screen.getAllByText("Foundation Session A").length).toBeGreaterThan(
      0,
    );
    expect(mocks.listWorkoutSessions).toHaveBeenCalledTimes(1);
    expect(mocks.listWorkoutSessions).toHaveBeenCalledWith({
      limit: 1,
      status: "in_progress",
    });
  });

  test("shows an empty state when nothing is assigned today", async () => {
    mocks.getTodayWorkouts.mockResolvedValueOnce(
      buildTodayWorkoutsResponse({ items: [] }),
    );
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );

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

  test("shows an open-workout action when the assignment has no active session", async () => {
    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );

    render(<HomePage />);

    expect(
      await screen.findByRole("link", { name: "Open workout" }),
    ).toBeVisible();
  });

  test("resumes an active session from the assigned workout card", async () => {
    const user = userEvent.setup();
    const activeSession = buildWorkoutSession({ id: "session_resume" });

    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([activeSession]),
    );

    render(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Resume" }));

    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_resume");
  });

  test("matches the active session to the assigned workout before rendering resume", async () => {
    const activeSession = buildWorkoutSession({ id: "session_live" });

    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([activeSession]),
    );

    render(<HomePage />);

    await screen.findByRole("button", { name: "Resume" });

    expect(
      screen.getByRole("heading", { name: "Assigned workouts" }),
    ).toBeVisible();
    expect(screen.getByText("In progress")).toBeVisible();
  });
});
