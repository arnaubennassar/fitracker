import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("shows a runner error when set logging fails", async ({ page }) => {
  await mockFitrackerApi(page, {
    failures: {
      createWorkoutSet: {
        body: {
          error: "Could not log the set.",
        },
        status: 500,
      },
    },
    sessions: [buildWorkoutSession({ id: "session_runner_error" })],
  });

  await page.goto("/sessions/session_runner_error");
  await page.getByRole("button", { name: "Complete set" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_runner_error$/);
  await expect(page.getByText("Could not log the set.")).toBeVisible();
});
