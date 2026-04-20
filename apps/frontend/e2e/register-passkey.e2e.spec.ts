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
    },
    passkeyStatus: {
      authenticated: false,
      hasPasskey: false,
    },
    registerSession: buildAuthSession(),
  });

  await page.goto("/login");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Assigned workouts" }),
  ).toBeVisible();
});
