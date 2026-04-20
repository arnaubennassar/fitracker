import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("restores runner state, logs a set, and reaches feedback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "fitracker.runner.session_runner",
      JSON.stringify({
        currentExerciseIndex: 0,
        exerciseTimerEndsAt: null,
        exerciseTimerExerciseId: null,
        exerciseTimerSeconds: null,
        restTimerEndsAt: null,
        updatedAt: Date.now(),
      }),
    );
  });
  await mockFitrackerApi(page, {
    sessions: [buildWorkoutSession({ id: "session_runner" })],
  });

  await page.goto("/sessions/session_runner");
  await page.getByRole("button", { name: "Complete set" }).click();
  await expect(
    page.getByRole("heading", { name: "Split stance row" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Finish workout" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_runner\/feedback$/);
  await expect(
    page.getByRole("heading", { name: "Session notes" }),
  ).toBeVisible();
});
