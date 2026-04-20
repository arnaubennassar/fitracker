import { expect, test } from "@playwright/test";

test("session runner restores state, logs a set, and reaches feedback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "fitracker.runner.session_smoke",
      JSON.stringify({
        currentExerciseIndex: 0,
        exerciseTimerEndsAt: null,
        exerciseTimerExerciseId: null,
        exerciseTimerSeconds: null,
        restTimerEndsAt: null,
        updatedAt: Date.now(),
      }),
    );
  });

  let createdSetCount = 0;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/api/v1/auth/me") {
      return json({
        authenticated: true,
        session: {
          expiresAt: "2026-04-21T09:00:00.000Z",
          id: "session_cookie",
          lastSeenAt: "2026-04-20T09:00:00.000Z",
        },
        user: {
          displayName: "Arnau",
          id: "user_arnau",
          status: "active",
        },
      });
    }

    if (
      pathname === "/api/v1/me/workout-sessions/session_smoke" &&
      method === "GET"
    ) {
      return json({
        assignmentId: "assignment_1",
        completedAt: null,
        durationSeconds: null,
        feedback: null,
        id: "session_smoke",
        notes: null,
        sets: [],
        startedAt: "2026-04-20T09:00:00.000Z",
        status: "in_progress",
        workoutTemplate: {
          id: "template_smoke",
          name: "Foundation Session A",
          slug: "foundation-session-a",
        },
      });
    }

    if (pathname === "/api/v1/me/workouts/template_smoke") {
      return json({
        id: "template_smoke",
        slug: "foundation-session-a",
        name: "Foundation Session A",
        description: "Main session",
        goal: "Strength",
        estimatedDurationMin: 40,
        difficulty: "beginner",
        exercises: [
          {
            blockLabel: "main",
            exercise: {
              description: "",
              difficulty: "beginner",
              id: "exercise_goblet_squat",
              name: "Goblet squat",
              slug: "goblet-squat",
              trackingMode: "reps",
            },
            id: "wte_goblet_squat",
            instructionOverride: null,
            isOptional: false,
            restSeconds: 60,
            rirTarget: null,
            rpeTarget: 7,
            sequence: 1,
            targetDistanceMeters: null,
            targetDurationSeconds: null,
            targetReps: null,
            targetRepsMax: 12,
            targetRepsMin: 10,
            targetSets: 1,
            targetWeight: 20,
            targetWeightUnit: "kg",
            tempo: null,
            workoutTemplateId: "template_smoke",
          },
        ],
      });
    }

    if (pathname === "/api/v1/me/exercises/exercise_goblet_squat") {
      return json({
        category: { id: "cat_strength", name: "Strength" },
        description: "",
        difficulty: "beginner",
        equipment: ["dumbbell"],
        id: "exercise_goblet_squat",
        instructions: "Brace and squat.",
        isActive: true,
        media: [],
        name: "Goblet squat",
        primaryMuscles: ["quads"],
        secondaryMuscles: ["glutes"],
        slug: "goblet-squat",
        trackingMode: "reps",
      });
    }

    if (
      pathname === "/api/v1/me/workout-sessions/session_smoke/sets" &&
      method === "POST"
    ) {
      createdSetCount += 1;
      return json(
        {
          completed: true,
          exercise: { id: "exercise_goblet_squat", name: "Goblet squat" },
          id: `set_${createdSetCount}`,
          loggedAt: "2026-04-20T09:05:00.000Z",
          notes: null,
          performedDistanceMeters: null,
          performedDurationSeconds: null,
          performedReps: 10,
          performedWeight: 20,
          performedWeightUnit: "kg",
          restSecondsActual: null,
          rpe: 7,
          sequence: 1,
          setNumber: 1,
          workoutSessionId: "session_smoke",
          workoutTemplateExerciseId: "wte_goblet_squat",
        },
        201,
      );
    }

    if (
      pathname === "/api/v1/me/workout-sessions/session_smoke/complete" &&
      method === "POST"
    ) {
      return json({
        assignmentId: "assignment_1",
        completedAt: "2026-04-20T09:20:00.000Z",
        durationSeconds: 1200,
        feedback: null,
        id: "session_smoke",
        notes: null,
        sets: [
          {
            completed: true,
            exercise: { id: "exercise_goblet_squat", name: "Goblet squat" },
            id: "set_1",
            loggedAt: "2026-04-20T09:05:00.000Z",
            notes: null,
            performedDistanceMeters: null,
            performedDurationSeconds: null,
            performedReps: 10,
            performedWeight: 20,
            performedWeightUnit: "kg",
            restSecondsActual: null,
            rpe: 7,
            sequence: 1,
            setNumber: 1,
            workoutSessionId: "session_smoke",
            workoutTemplateExerciseId: "wte_goblet_squat",
          },
        ],
        startedAt: "2026-04-20T09:00:00.000Z",
        status: "completed",
        workoutTemplate: {
          id: "template_smoke",
          name: "Foundation Session A",
          slug: "foundation-session-a",
        },
      });
    }

    if (
      pathname === "/api/v1/me/workout-sessions/session_smoke" &&
      method === "POST"
    ) {
      return json({}, 404);
    }

    if (
      pathname === "/api/v1/me/workout-sessions/session_smoke/feedback" &&
      method === "POST"
    ) {
      return json({
        difficultyRating: 7,
        energyRating: 4,
        freeText: "Solid",
        id: "feedback_1",
        mood: "good",
        painFlag: false,
        painNotes: null,
        submittedAt: "2026-04-20T09:21:00.000Z",
        workoutSessionId: "session_smoke",
      });
    }

    return json({ error: `Unhandled ${method} ${pathname}` }, 500);
  });

  await Promise.all([
    page.waitForResponse("**/api/v1/auth/me"),
    page.waitForResponse("**/api/v1/me/workout-sessions/session_smoke"),
    page.waitForResponse("**/api/v1/me/workouts/template_smoke"),
    page.goto("/sessions/session_smoke"),
  ]);

  await expect(page.getByText("Foundation Session A")).toBeVisible();
  await expect(page.locator("h2.hero-title")).toHaveText("Goblet squat");
  await expect(page.getByRole("heading", { name: "Log set 1" })).toBeVisible();

  await page.getByRole("button", { name: "Complete set" }).click();
  await expect(page.getByText("1: 10")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Exercise complete" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page).toHaveURL(/\/sessions\/session_smoke\/feedback$/);
  await expect(
    page.getByText(
      "Fast notes for the next prescription. Keep it short and real.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "good" })).toBeVisible();
});
