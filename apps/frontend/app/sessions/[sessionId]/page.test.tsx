import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildExerciseDetail,
  buildWorkoutSession,
  buildWorkoutSet,
  buildWorkoutTemplateDetail,
} from "../../../test/fixtures";
import SessionRunnerPage from "./page";

const mocks = vi.hoisted(() => ({
  completeWorkoutSession: vi.fn(),
  createWorkoutSet: vi.fn(),
  getExerciseDetail: vi.fn(),
  getWorkoutDetail: vi.fn(),
  getWorkoutSession: vi.fn(),
  params: {
    sessionId: "session_foundation_a",
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

const storageMocks = vi.hoisted(() => ({
  clearRunnerState: vi.fn(),
  loadRunnerState: vi.fn(),
  saveRunnerState: vi.fn(),
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
    completeWorkoutSession: mocks.completeWorkoutSession,
    createWorkoutSet: mocks.createWorkoutSet,
    getExerciseDetail: mocks.getExerciseDetail,
    getWorkoutDetail: mocks.getWorkoutDetail,
    getWorkoutSession: mocks.getWorkoutSession,
  };
});

vi.mock("../../_lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../_lib/storage")>();

  storageMocks.clearRunnerState.mockImplementation(actual.clearRunnerState);
  storageMocks.loadRunnerState.mockImplementation(actual.loadRunnerState);
  storageMocks.saveRunnerState.mockImplementation(actual.saveRunnerState);

  return storageMocks;
});

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("../../_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("session runner page", () => {
  beforeEach(() => {
    mocks.completeWorkoutSession.mockReset();
    mocks.createWorkoutSet.mockReset();
    mocks.getExerciseDetail.mockReset();
    mocks.getWorkoutDetail.mockReset();
    mocks.getWorkoutSession.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.params = { sessionId: "session_foundation_a" };
    mocks.session = buildAuthSession();
    window.localStorage.clear();
    storageMocks.clearRunnerState.mockClear();
    storageMocks.loadRunnerState.mockClear();
    storageMocks.saveRunnerState.mockClear();
  });

  test("restores persisted runner state and suggests values from the prior set", async () => {
    const session = buildWorkoutSession({
      sets: [
        buildWorkoutSet({
          performedReps: 11,
          performedWeight: 22,
          rpe: 8,
        }),
      ],
    });
    const restTimerEndsAt = Date.now() + 60_000;

    window.localStorage.setItem(
      "fitracker.runner.session_foundation_a",
      JSON.stringify({
        currentExerciseIndex: 0,
        exerciseTimerEndsAt: null,
        exerciseTimerExerciseId: null,
        exerciseTimerSeconds: null,
        restTimerEndsAt,
        updatedAt: Date.now(),
      }),
    );
    mocks.getWorkoutSession.mockResolvedValueOnce(session);
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockResolvedValue(buildExerciseDetail());

    render(<SessionRunnerPage />);

    expect(
      await screen.findByRole("heading", { name: "Log set 2" }),
    ).toBeVisible();
    expect(await screen.findByDisplayValue("11")).toBeVisible();
    expect(await screen.findByDisplayValue("22")).toBeVisible();
    expect(screen.getByText("Rest")).toBeVisible();
    expect(storageMocks.loadRunnerState).toHaveBeenCalledWith(
      "session_foundation_a",
    );
  });

  test("logs a set, updates progress, and advances to the next exercise", async () => {
    const user = userEvent.setup();
    const template = buildWorkoutTemplateDetail();
    const firstExercise = template.exercises[0];
    const secondExercise = template.exercises[1];

    if (!firstExercise || !secondExercise) {
      throw new Error(
        "Expected workout template fixtures to include two exercises.",
      );
    }

    const workout = buildWorkoutTemplateDetail({
      exercises: [
        {
          ...firstExercise,
          targetSets: 1,
        },
        secondExercise,
      ],
    });

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(workout);
    mocks.getExerciseDetail.mockImplementation(async (exerciseId: string) =>
      buildExerciseDetail({
        id: exerciseId,
        instructions:
          exerciseId === "exercise_split_stance_row"
            ? "Step back and row."
            : "Brace and squat.",
        name:
          exerciseId === "exercise_split_stance_row"
            ? "Split stance row"
            : "Goblet squat",
        slug:
          exerciseId === "exercise_split_stance_row"
            ? "split-stance-row"
            : "goblet-squat",
        trackingMode:
          exerciseId === "exercise_split_stance_row" ? "mixed" : "reps",
      }),
    );
    mocks.createWorkoutSet.mockResolvedValueOnce(buildWorkoutSet());

    render(<SessionRunnerPage />);

    await user.click(
      await screen.findByRole("button", { name: "Complete set" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Split stance row",
      }),
    ).toBeVisible();
    expect(screen.getByText(/1 \/ 2 exercises done/)).toBeVisible();
  });

  test("starts the exercise timer and lets the athlete skip rest", async () => {
    const user = userEvent.setup();
    const template = buildWorkoutTemplateDetail();
    const firstExercise = template.exercises[0];
    const secondExercise = template.exercises[1];

    if (!firstExercise || !secondExercise) {
      throw new Error(
        "Expected workout template fixtures to include two exercises.",
      );
    }

    const timeExercise = {
      ...firstExercise,
      exercise: {
        ...firstExercise.exercise,
        trackingMode: "time" as const,
      },
      targetDurationSeconds: 90,
      targetRepsMax: null,
      targetRepsMin: null,
      targetWeight: null,
      targetWeightUnit: null,
    };

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(
      buildWorkoutTemplateDetail({
        exercises: [timeExercise, secondExercise],
      }),
    );
    mocks.getExerciseDetail.mockResolvedValue(buildExerciseDetail());
    mocks.createWorkoutSet.mockResolvedValueOnce(
      buildWorkoutSet({
        performedDurationSeconds: 90,
        performedReps: null,
        performedWeight: null,
        performedWeightUnit: null,
      }),
    );

    render(<SessionRunnerPage />);

    await user.click(
      await screen.findByRole("button", { name: "Start exercise timer" }),
    );
    expect(await screen.findByText("Exercise timer")).toBeVisible();
    expect(
      screen.getByText((content) => /^1:3[01]$/.test(content)),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Complete set" }));
    expect(await screen.findByText("Rest")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => {
      expect(screen.queryByText("Rest")).not.toBeInTheDocument();
    });
  });

  test("completes the workout, clears runner state, and routes to feedback", async () => {
    const user = userEvent.setup();

    window.localStorage.setItem(
      "fitracker.runner.session_foundation_a",
      JSON.stringify({
        currentExerciseIndex: 1,
        exerciseTimerEndsAt: null,
        exerciseTimerExerciseId: null,
        exerciseTimerSeconds: null,
        restTimerEndsAt: null,
        updatedAt: Date.now(),
      }),
    );
    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockResolvedValue(buildExerciseDetail());
    mocks.completeWorkoutSession.mockResolvedValueOnce(
      buildWorkoutSession({
        completedAt: "2026-04-20T10:00:00.000Z",
        durationSeconds: 1800,
        status: "completed",
      }),
    );

    render(<SessionRunnerPage />);

    await user.click(
      await screen.findByRole("button", { name: "Finish workout" }),
    );

    await waitFor(() => {
      expect(storageMocks.clearRunnerState).toHaveBeenCalledWith(
        "session_foundation_a",
      );
    });
    expect(mocks.push).toHaveBeenCalledWith(
      "/sessions/session_foundation_a/feedback",
    );
  });

  test("shows an error banner when the session fails to load", async () => {
    mocks.getWorkoutSession.mockRejectedValueOnce(
      await createApiError("Could not load the session.", 500),
    );

    render(<SessionRunnerPage />);

    expect(
      await screen.findByText("Could not load the session."),
    ).toBeVisible();
  });

  test("shows an error banner when set logging fails", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockResolvedValue(buildExerciseDetail());
    mocks.createWorkoutSet.mockRejectedValueOnce(
      await createApiError("Could not log the set.", 500),
    );

    render(<SessionRunnerPage />);

    await user.click(
      await screen.findByRole("button", { name: "Complete set" }),
    );

    expect(await screen.findByText("Could not log the set.")).toBeVisible();
  });

  test("shows an error banner when workout completion fails", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockResolvedValue(buildExerciseDetail());
    mocks.completeWorkoutSession.mockRejectedValueOnce(
      await createApiError("Could not finish workout.", 500),
    );

    render(<SessionRunnerPage />);

    await user.click(
      await screen.findByRole("button", { name: "Finish workout" }),
    );

    expect(await screen.findByText("Could not finish workout.")).toBeVisible();
  });

  test("clamps persisted exercise state to the final exercise index", async () => {
    window.localStorage.setItem(
      "fitracker.runner.session_foundation_a",
      JSON.stringify({
        currentExerciseIndex: 99,
        exerciseTimerEndsAt: null,
        exerciseTimerExerciseId: null,
        exerciseTimerSeconds: null,
        restTimerEndsAt: null,
        updatedAt: Date.now(),
      }),
    );
    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockImplementation(async (exerciseId: string) =>
      buildExerciseDetail({
        id: exerciseId,
        instructions:
          exerciseId === "exercise_split_stance_row"
            ? "Step back and row."
            : "Brace and squat.",
        name:
          exerciseId === "exercise_split_stance_row"
            ? "Split stance row"
            : "Goblet squat",
        slug:
          exerciseId === "exercise_split_stance_row"
            ? "split-stance-row"
            : "goblet-squat",
        trackingMode:
          exerciseId === "exercise_split_stance_row" ? "mixed" : "reps",
      }),
    );

    render(<SessionRunnerPage />);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Split stance row",
      }),
    ).toBeVisible();
  });

  test("redirects unauthenticated athletes to login", async () => {
    mocks.session = {
      authenticated: false,
      session: null,
      user: null,
    };

    render(<SessionRunnerPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login");
    });
  });
});
