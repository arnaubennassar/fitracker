import { expect, test } from "@playwright/test";

import { mockFitrackerApi } from "./helpers/mock-api";
import { installPasskeyStub } from "./helpers/passkey";

test("shows the missing-passkey guidance when sign-in cannot find a saved credential", async ({
  page,
}) => {
  await installPasskeyStub(page);
  await mockFitrackerApi(page, {
    authSession: {
      authenticated: false,
      session: null,
      user: null,
    },
    failures: {
      loginOptions: {
        body: {
          code: "PASSKEY_NOT_REGISTERED",
          error: "This user does not have a registered passkey.",
        },
        status: 404,
      },
    },
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();

  await expect(
    page.getByText(
      "No saved passkey is registered for that athlete yet. Use Create passkey on this device first.",
    ),
  ).toBeVisible();
});
