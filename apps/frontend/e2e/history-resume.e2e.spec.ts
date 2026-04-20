import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("resumes an in-progress session from history", async ({ page }) => {
  await mockFitrackerApi(page, {
    sessions: [
      buildWorkoutSession({
        completedAt: "2026-04-20T10:15:00.000Z",
        durationSeconds: 1800,
        id: "session_complete",
        status: "completed",
      }),
      buildWorkoutSession({ id: "session_history_resume" }),
    ],
  });

  await page.goto("/history");
  await page.getByRole("link", { name: "Resume" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_history_resume$/);
});
