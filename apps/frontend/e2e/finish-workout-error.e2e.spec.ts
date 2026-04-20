import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("keeps the athlete on the runner when workout completion fails", async ({
  page,
}) => {
  await mockFitrackerApi(page, {
    failures: {
      completeWorkoutSession: {
        body: {
          error: "Could not finish workout.",
        },
        status: 500,
      },
    },
    sessions: [buildWorkoutSession({ id: "session_finish_error" })],
  });

  await page.goto("/sessions/session_finish_error");
  await page.getByRole("button", { name: "Finish workout" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_finish_error$/);
  await expect(page.getByText("Could not finish workout.")).toBeVisible();
});
