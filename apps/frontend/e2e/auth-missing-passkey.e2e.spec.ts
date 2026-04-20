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
    },
    passkeyStatus: {
      authenticated: false,
      hasPasskey: true,
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

  await expect(
    page.getByText(
      "No passkey is registered yet on this app. Retry to create one on this device.",
    ),
  ).toBeVisible();
});
