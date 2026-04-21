import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("returns to the dashboard from history using the top home control", async ({
  page,
}) => {
  await mockFitrackerApi(page);

  await page.goto("/history");
  await page.getByRole("link", { name: "Home" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Assigned workouts" }),
  ).toBeVisible();
});
