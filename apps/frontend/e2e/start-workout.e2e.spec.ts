import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";

test("shows the minimal workout layout and starts a workout", async ({
  page,
}) => {
  await mockFitrackerApi(page);

  await page.goto("/workouts/template_foundation_a");

  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Foundation Session A" }),
  ).toBeVisible();
  await expect(page.getByText("Exercise plan")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Start workout" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_created_1$/);
});
