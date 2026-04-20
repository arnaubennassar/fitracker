import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("loads the dashboard and opens an assigned workout", async ({ page }) => {
  await mockFitrackerApi(page);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Assigned workouts" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open workout" }).click();

  await expect(page).toHaveURL(/\/workouts\/template_foundation_a$/);
});
