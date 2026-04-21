import { expect, test } from "@playwright/test";

import {
  buildTodayWorkoutsResponse,
  buildWorkoutAssignment,
} from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("refreshes dashboard content after the page regains focus", async ({
  page,
}) => {
  const api = await mockFitrackerApi(page);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Assigned workouts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Foundation Session A" }),
  ).toBeVisible();

  api.setTodayWorkouts(
    buildTodayWorkoutsResponse({
      items: [
        buildWorkoutAssignment(),
        buildWorkoutAssignment({
          id: "assignment_foundation_b",
          workoutTemplate: {
            ...buildWorkoutAssignment().workoutTemplate,
            id: "template_foundation_b",
            name: "Foundation Session B",
            slug: "foundation-session-b",
          },
        }),
      ],
    }),
  );

  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });

  await expect(
    page.getByRole("heading", { name: "Foundation Session B" }),
  ).toBeVisible();
});
