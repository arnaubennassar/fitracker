import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("stays on the workout detail page when starting a workout fails", async ({
  page,
}) => {
  await mockFitrackerApi(page, {
    failures: {
      createWorkoutSession: {
        body: {
          error: "Could not start the workout.",
        },
        status: 500,
      },
    },
  });

  await page.goto("/workouts/template_foundation_a");
  await page.getByRole("button", { name: "Start workout" }).click();

  await expect(page).toHaveURL(/\/workouts\/template_foundation_a$/);
  await expect(page.getByText("Could not start the workout.")).toBeVisible();
});
