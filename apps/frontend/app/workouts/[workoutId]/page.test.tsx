import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildExerciseDetail,
  buildTodayWorkoutsResponse,
  buildWorkoutSession,
  buildWorkoutSessionListResponse,
  buildWorkoutTemplateDetail,
} from "../../../test/fixtures";
import WorkoutDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  createWorkoutSession: vi.fn(),
  getExerciseDetail: vi.fn(),
  getTodayWorkouts: vi.fn(),
  getWorkoutDetail: vi.fn(),
  listWorkoutSessions: vi.fn(),
  params: {
    workoutId: "template_foundation_a",
  },
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
  useParams: () => mocks.params,
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock("../../providers", () => ({
  useSession: () => ({
    loading: false,
    session: mocks.session,
  }),
}));

vi.mock("../../_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../_lib/api")>();

  return {
    ...actual,
    createWorkoutSession: mocks.createWorkoutSession,
    getExerciseDetail: mocks.getExerciseDetail,
    getTodayWorkouts: mocks.getTodayWorkouts,
    getWorkoutDetail: mocks.getWorkoutDetail,
    listWorkoutSessions: mocks.listWorkoutSessions,
  };
});

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("../../_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("workout detail page", () => {
  beforeEach(() => {
    mocks.createWorkoutSession.mockReset();
    mocks.getExerciseDetail.mockReset();
    mocks.getTodayWorkouts.mockReset();
    mocks.getWorkoutDetail.mockReset();
    mocks.listWorkoutSessions.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.params = { workoutId: "template_foundation_a" };
    mocks.session = buildAuthSession();
  });

  test("loads the workout and expands the first exercise by default", async () => {
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );
    mocks.getExerciseDetail
      .mockResolvedValueOnce(buildExerciseDetail())
      .mockResolvedValueOnce(
        buildExerciseDetail({
          id: "exercise_split_stance_row",
          instructions: "Step back and row.",
          name: "Split stance row",
          slug: "split-stance-row",
          trackingMode: "mixed",
        }),
      );

    render(<WorkoutDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Foundation Session A" }),
    ).toBeVisible();
    expect(await screen.findByText("Brace and squat.")).toBeVisible();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Split stance row/i }));

    expect(await screen.findByText("Step back and row.")).toBeVisible();
  });

  test("shows a resume action when the workout already has an active session", async () => {
    const activeSession = buildWorkoutSession({ id: "session_live" });

    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([activeSession]),
    );
    mocks.getExerciseDetail.mockResolvedValueOnce(buildExerciseDetail());

    render(<WorkoutDetailPage />);

    expect(
      await screen.findByRole("link", { name: "Resume current session" }),
    ).toHaveAttribute("href", "/sessions/session_live");
    expect(
      screen.queryByRole("button", { name: "Start workout" }),
    ).not.toBeInTheDocument();
  });

  test("starts a workout session and routes to the runner", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );
    mocks.getExerciseDetail.mockResolvedValueOnce(buildExerciseDetail());
    mocks.createWorkoutSession.mockResolvedValueOnce(
      buildWorkoutSession({ id: "session_new" }),
    );

    render(<WorkoutDetailPage />);

    await user.click(
      await screen.findByRole("button", { name: "Start workout" }),
    );

    await waitFor(() => {
      expect(mocks.createWorkoutSession).toHaveBeenCalledWith({
        assignmentId: "assignment_foundation_a",
        workoutTemplateId: "template_foundation_a",
      });
    });
    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_new");
  });

  test("shows an error when starting the workout fails", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getTodayWorkouts.mockResolvedValueOnce(buildTodayWorkoutsResponse());
    mocks.listWorkoutSessions.mockResolvedValueOnce(
      buildWorkoutSessionListResponse([]),
    );
    mocks.getExerciseDetail.mockResolvedValueOnce(buildExerciseDetail());
    mocks.createWorkoutSession.mockRejectedValueOnce(
      await createApiError("Could not start the workout.", 500),
    );

    render(<WorkoutDetailPage />);

    await user.click(
      await screen.findByRole("button", { name: "Start workout" }),
    );

    expect(
      await screen.findByText("Could not start the workout."),
    ).toBeVisible();
  });
});
