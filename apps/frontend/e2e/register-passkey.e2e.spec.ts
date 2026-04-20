import { expect, test } from "@playwright/test";

import { buildAuthSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";
import { installPasskeyStub } from "./helpers/passkey";

test("creates a passkey and lands on the dashboard", async ({ page }) => {
  await installPasskeyStub(page);
  await mockFitrackerApi(page, {
    authSession: {
      authenticated: false,
      session: null,
      user: null,
    },
    registerSession: buildAuthSession({
      user: {
        displayName: "Nina",
        id: "user_nina",
        status: "active",
      },
    }),
  });

  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Athlete ID", exact: true })
    .fill("user_nina");
  await page.getByRole("textbox", { name: "Display name" }).fill("Nina");
  await page.getByRole("button", { name: "Create passkey" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Assigned workouts" }),
  ).toBeVisible();
});
