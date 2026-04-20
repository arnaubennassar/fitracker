import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("shows the dashboard load error when today's workouts fail", async ({
  page,
}) => {
  await mockFitrackerApi(page, {
    failures: {
      todayWorkouts: {
        body: {
          error: "Could not load today from the server.",
        },
        status: 500,
      },
    },
  });

  await page.goto("/");

  await expect(
    page.getByText("Could not load today from the server."),
  ).toBeVisible();
});
