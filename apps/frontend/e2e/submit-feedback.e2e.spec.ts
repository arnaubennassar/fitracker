import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("submits feedback and returns to history", async ({ page }) => {
  await mockFitrackerApi(page, {
    sessions: [
      buildWorkoutSession({
        completedAt: "2026-04-20T10:15:00.000Z",
        durationSeconds: 1800,
        id: "session_feedback",
        status: "completed",
      }),
    ],
  });

  await page.goto("/sessions/session_feedback/feedback");
  await page.getByRole("button", { name: "good" }).click();
  await page.getByLabel("Coach note").fill("Closed strong.");
  await page.getByRole("button", { name: "Save feedback" }).click();

  await expect(page).toHaveURL(/\/history$/);
});
