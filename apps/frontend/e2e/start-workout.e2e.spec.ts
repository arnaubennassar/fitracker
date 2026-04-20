import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("starts a workout from the detail page", async ({ page }) => {
  await mockFitrackerApi(page);

  await page.goto("/workouts/template_foundation_a");
  await page.getByRole("button", { name: "Start workout" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_created_1$/);
});
