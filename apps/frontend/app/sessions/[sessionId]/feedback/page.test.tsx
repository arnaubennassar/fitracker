import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildAuthSession,
  buildWorkoutFeedback,
  buildWorkoutSession,
} from "../../../../test/fixtures";
import FeedbackPage from "./page";

const mocks = vi.hoisted(() => ({
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
  submitWorkoutFeedback: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock("../../../providers", () => ({
  useSession: () => ({
    loading: false,
    session: mocks.session,
  }),
}));

vi.mock("../../../_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../_lib/api")>();

  return {
    ...actual,
    getWorkoutSession: mocks.getWorkoutSession,
    submitWorkoutFeedback: mocks.submitWorkoutFeedback,
  };
});

async function createApiError(
  message: string,
  statusCode: number,
  code?: string,
) {
  const { ApiError } = await import("../../../_lib/api");

  return new ApiError(message, statusCode, code);
}

describe("feedback page", () => {
  beforeEach(() => {
    mocks.getWorkoutSession.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.submitWorkoutFeedback.mockReset();
    mocks.params = { sessionId: "session_foundation_a" };
    mocks.session = buildAuthSession();
  });

  test("preloads feedback and toggles pain notes visibility", async () => {
    mocks.getWorkoutSession.mockResolvedValueOnce(
      buildWorkoutSession({
        completedAt: "2026-04-20T10:00:00.000Z",
        feedback: buildWorkoutFeedback({
          painFlag: true,
          painNotes: "Left knee felt warm.",
        }),
        status: "completed",
      }),
    );

    render(<FeedbackPage />);

    expect(await screen.findByDisplayValue("Felt steady.")).toBeVisible();
    expect(screen.getByDisplayValue("Left knee felt warm.")).toBeVisible();

    await userEvent
      .setup()
      .click(
        screen.getByRole("checkbox", { name: "Pain or discomfort to flag" }),
      );

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue("Left knee felt warm."),
      ).not.toBeInTheDocument();
    });
  });

  test("trims optional notes and routes back to history after save", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.submitWorkoutFeedback.mockResolvedValueOnce(buildWorkoutFeedback());

    render(<FeedbackPage />);

    await screen.findByRole("heading", { name: "Session notes" });
    await user.click(screen.getByRole("button", { name: "good" }));

    const difficultyField = screen.getByText("Difficulty").closest(".field");
    const energyField = screen.getByText("Energy").closest(".field");

    if (
      !(difficultyField instanceof HTMLElement) ||
      !(energyField instanceof HTMLElement)
    ) {
      throw new Error("Expected rating fields to render.");
    }

    await user.click(
      within(difficultyField).getByRole("button", { name: "7" }),
    );
    await user.click(within(energyField).getByRole("button", { name: "4" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Pain or discomfort to flag" }),
    );
    await user.type(
      screen.getByLabelText("Pain notes"),
      "  Left hip was tight.  ",
    );
    await user.type(
      screen.getByLabelText("Coach note"),
      "  Strong closeout.  ",
    );
    await user.click(screen.getByRole("button", { name: "Save feedback" }));

    await waitFor(() => {
      expect(mocks.submitWorkoutFeedback).toHaveBeenCalledWith(
        "session_foundation_a",
        {
          difficultyRating: 7,
          energyRating: 4,
          freeText: "Strong closeout.",
          mood: "good",
          painFlag: true,
          painNotes: "Left hip was tight.",
        },
      );
    });
    expect(mocks.push).toHaveBeenCalledWith("/history");
  });

  test("shows the save error banner when feedback submission fails", async () => {
    const user = userEvent.setup();

    mocks.getWorkoutSession.mockResolvedValueOnce(buildWorkoutSession());
    mocks.submitWorkoutFeedback.mockRejectedValueOnce(
      await createApiError("Could not save feedback.", 500),
    );

    render(<FeedbackPage />);

    await user.click(
      await screen.findByRole("button", { name: "Save feedback" }),
    );

    expect(await screen.findByText("Could not save feedback.")).toBeVisible();
  });
});
