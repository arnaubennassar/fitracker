import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("shows a save error when feedback submission fails", async ({ page }) => {
  await mockFitrackerApi(page, {
    failures: {
      feedback: {
        body: {
          error: "Could not save feedback.",
        },
        status: 500,
      },
    },
    sessions: [
      buildWorkoutSession({
        completedAt: "2026-04-20T10:15:00.000Z",
        durationSeconds: 1800,
        id: "session_feedback_error",
        status: "completed",
      }),
    ],
  });

  await page.goto("/sessions/session_feedback_error/feedback");
  await page.getByRole("button", { name: "Save feedback" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_feedback_error\/feedback$/);
  await expect(page.getByText("Could not save feedback.")).toBeVisible();
});
