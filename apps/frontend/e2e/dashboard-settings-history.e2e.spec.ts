import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("opens history from the dashboard settings menu", async ({ page }) => {
  await mockFitrackerApi(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitem", { name: "History" }).click();

  await expect(page).toHaveURL(/\/history$/);
  await expect(
    page.getByRole("heading", { exact: true, name: "History" }),
  ).toBeVisible();
});
