import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("resumes an in-progress session from the dashboard", async ({ page }) => {
  await mockFitrackerApi(page, {
    sessions: [buildWorkoutSession({ id: "session_resume" })],
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Resume" }).click();

  await expect(page).toHaveURL(/\/sessions\/session_resume$/);
});
