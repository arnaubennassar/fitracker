import { expect, test } from "@playwright/test";

import { buildWorkoutSession } from "../test/fixtures";
import { mockFitrackerApi } from "./helpers/mock-api";

test("opens history and follows up on a completed session", async ({
  page,
}) => {
  await mockFitrackerApi(page, {
    sessions: [
      buildWorkoutSession({ id: "session_resume" }),
      buildWorkoutSession({
        completedAt: "2026-04-20T10:15:00.000Z",
        durationSeconds: 1800,
        id: "session_history_feedback",
        status: "completed",
      }),
    ],
  });

  await page.goto("/history");
  await expect(page.getByRole("link", { name: "Resume" })).toBeVisible();

  await page.getByRole("link", { name: "Add feedback" }).click();

  await expect(page).toHaveURL(
    /\/sessions\/session_history_feedback\/feedback$/,
  );
  await expect(
    page.getByRole("heading", { name: "Session notes" }),
  ).toBeVisible();
});
