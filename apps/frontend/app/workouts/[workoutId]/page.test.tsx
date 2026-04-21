import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildExerciseDetail,
  buildWorkoutTemplateDetail,
} from "../../../test/fixtures";
import WorkoutDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getExerciseDetail: vi.fn(),
  getWorkoutDetail: vi.fn(),
  params: {
    workoutId: "template_foundation_a",
  },
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
  useParams: () => mocks.params,
  useRouter: () => ({
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
    getExerciseDetail: mocks.getExerciseDetail,
    getWorkoutDetail: mocks.getWorkoutDetail,
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
    mocks.getExerciseDetail.mockReset();
    mocks.getWorkoutDetail.mockReset();
    mocks.replace.mockReset();
    mocks.params = { workoutId: "template_foundation_a" };
    mocks.session = buildAuthSession();
  });

  test("loads the workout and expands the first exercise by default", async () => {
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
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
    expect(screen.getByText("Exercise plan")).toBeVisible();
    expect(await screen.findByText("Brace and squat.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Start workout" }),
    ).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Split stance row/i }));

    expect(await screen.findByText("Step back and row.")).toBeVisible();
  });

  test("loads the workout even if the selected exercise detail request fails", async () => {
    mocks.getWorkoutDetail.mockResolvedValueOnce(buildWorkoutTemplateDetail());
    mocks.getExerciseDetail.mockRejectedValueOnce(
      new Error("Exercise unavailable."),
    );

    render(<WorkoutDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Foundation Session A" }),
    ).toBeVisible();
    expect(screen.queryByText("Brace and squat.")).not.toBeInTheDocument();
  });

  test("shows a load error when the workout request fails", async () => {
    mocks.getWorkoutDetail.mockRejectedValueOnce(
      await createApiError("Could not load the workout.", 500),
    );

    render(<WorkoutDetailPage />);

    expect(
      await screen.findByText("Could not load the workout."),
    ).toBeVisible();
  });
});
