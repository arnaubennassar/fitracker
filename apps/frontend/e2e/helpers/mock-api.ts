import type { Page, Route } from "@playwright/test";

import type {
  AuthSession,
  ExerciseDetail,
  TodayWorkoutsResponse,
  WorkoutFeedback,
  WorkoutSessionDetail,
  WorkoutTemplateDetail,
} from "../../app/_lib/types";
import {
  buildAuthSession,
  buildExerciseDetail,
  buildTodayWorkoutsResponse,
  buildWorkoutFeedback,
  buildWorkoutSession,
  buildWorkoutSet,
  buildWorkoutTemplateDetail,
} from "../../test/fixtures";

type MockApiOptions = {
  authSession?: AuthSession;
  exercises?: Record<string, ExerciseDetail>;
  failures?: Partial<
    Record<
      | "authSession"
      | "createWorkoutSession"
      | "createWorkoutSet"
      | "completeWorkoutSession"
      | "feedback"
      | "loginOptions"
      | "todayWorkouts"
      | "workoutDetail",
      {
        body?: { code?: string; error?: string };
        status: number;
      }
    >
  >;
  loginSession?: AuthSession;
  registerSession?: AuthSession;
  sessions?: WorkoutSessionDetail[];
  todayWorkouts?: TodayWorkoutsResponse;
  workouts?: Record<string, WorkoutTemplateDetail>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultExerciseMap(workout: WorkoutTemplateDetail) {
  return Object.fromEntries(
    workout.exercises.map((item) => [
      item.exercise.id,
      buildExerciseDetail({
        id: item.exercise.id,
        instructions:
          item.exercise.id === "exercise_split_stance_row"
            ? "Step back and row."
            : "Brace and squat.",
        name: item.exercise.name,
        slug: item.exercise.slug,
        trackingMode: item.exercise.trackingMode,
      }),
    ]),
  );
}

function sessionSortKey(session: WorkoutSessionDetail) {
  return session.completedAt ?? session.startedAt;
}

function listSessions(
  sessions: WorkoutSessionDetail[],
  searchParams: URLSearchParams,
) {
  const limit = Number(searchParams.get("limit") ?? `${sessions.length || 1}`);
  const offset = Number(searchParams.get("offset") ?? "0");
  const status = searchParams.get("status");
  const filtered = sessions
    .filter((item) => (status ? item.status === status : true))
    .sort((left, right) =>
      sessionSortKey(right).localeCompare(sessionSortKey(left)),
    );
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    limit,
    offset,
    total: filtered.length,
  };
}

export async function mockFitrackerApi(
  page: Page,
  options: MockApiOptions = {},
) {
  const defaultWorkout = buildWorkoutTemplateDetail();
  const state = {
    authSession: clone(options.authSession ?? buildAuthSession()),
    exercises: {
      ...defaultExerciseMap(defaultWorkout),
      ...(options.exercises ?? {}),
    },
    loginSession: clone(options.loginSession ?? buildAuthSession()),
    registerSession: clone(options.registerSession ?? buildAuthSession()),
    sessions: clone(options.sessions ?? []),
    todayWorkouts: clone(options.todayWorkouts ?? buildTodayWorkoutsResponse()),
    workouts: {
      [defaultWorkout.id]: defaultWorkout,
      ...(options.workouts ?? {}),
    },
  };
  let nextSessionId = state.sessions.length + 1;
  let nextSetId = 1;

  async function json(route: Route, body: unknown, status = 200) {
    await route.fulfill({
      body: JSON.stringify(body),
      contentType: "application/json",
      status,
    });
  }

  async function fail(
    route: Route,
    key: keyof NonNullable<MockApiOptions["failures"]>,
  ) {
    const failure = options.failures?.[key];

    if (!failure) {
      return false;
    }

    await json(
      route,
      failure.body ?? { error: "Mocked API failure." },
      failure.status,
    );
    return true;
  }

  await page.route("**/api/v1/**", async (route) => {
    try {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const { pathname, searchParams } = url;

      if (pathname === "/api/v1/auth/me" && method === "GET") {
        if (await fail(route, "authSession")) {
          return;
        }

        return json(route, state.authSession);
      }

      if (
        pathname === "/api/v1/auth/passkey/login/options" &&
        method === "POST"
      ) {
        if (await fail(route, "loginOptions")) {
          return;
        }

        return json(route, {
          challengeId: "challenge_e2e",
          publicKey: {
            allowCredentials: [],
            challenge: "Y2hhbGxlbmdl",
            rpId: "127.0.0.1",
            timeout: 60000,
            userVerification: "required",
          },
        });
      }

      if (
        pathname === "/api/v1/auth/passkey/login/verify" &&
        method === "POST"
      ) {
        state.authSession = clone(state.loginSession);
        return json(route, state.loginSession);
      }

      if (
        pathname === "/api/v1/auth/passkey/register/options" &&
        method === "POST"
      ) {
        const payload = request.postDataJSON() as {
          displayName: string;
          userId: string;
        };

        return json(route, {
          challengeId: "challenge_register_e2e",
          publicKey: {
            attestation: "none",
            challenge: "Y2hhbGxlbmdlX3JlZ2lzdGVy",
            excludeCredentials: [],
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            rp: {
              id: "127.0.0.1",
              name: "Fitracker Test",
            },
            timeout: 60000,
            user: {
              displayName: payload.displayName,
              id: "dXNlcl9lMmU",
              name: payload.userId,
            },
          },
        });
      }

      if (
        pathname === "/api/v1/auth/passkey/register/verify" &&
        method === "POST"
      ) {
        state.authSession = clone(state.registerSession);
        return json(route, state.registerSession);
      }

      if (pathname === "/api/v1/me/workouts/today" && method === "GET") {
        if (await fail(route, "todayWorkouts")) {
          return;
        }

        return json(route, state.todayWorkouts);
      }

      if (pathname === "/api/v1/me/workout-sessions" && method === "GET") {
        return json(route, listSessions(state.sessions, searchParams));
      }

      if (pathname === "/api/v1/me/workout-sessions" && method === "POST") {
        if (await fail(route, "createWorkoutSession")) {
          return;
        }

        const payload = request.postDataJSON() as {
          assignmentId?: string | null;
          workoutTemplateId: string;
        };
        const workout = state.workouts[payload.workoutTemplateId];

        if (!workout) {
          return json(route, { error: "Workout not found." }, 404);
        }

        const session = buildWorkoutSession({
          assignmentId: payload.assignmentId ?? null,
          id: `session_created_${nextSessionId}`,
          workoutTemplate: {
            id: workout.id,
            name: workout.name,
            slug: workout.slug,
          },
        });

        nextSessionId += 1;
        state.sessions.unshift(session);
        return json(route, session, 201);
      }

      if (pathname.startsWith("/api/v1/me/workouts/") && method === "GET") {
        if (await fail(route, "workoutDetail")) {
          return;
        }

        const workoutId = pathname.replace("/api/v1/me/workouts/", "");
        const workout = state.workouts[workoutId];

        if (!workout) {
          return json(route, { error: "Workout not found." }, 404);
        }

        return json(route, workout);
      }

      if (pathname.startsWith("/api/v1/me/exercises/") && method === "GET") {
        const exerciseId = pathname.replace("/api/v1/me/exercises/", "");
        const exercise = state.exercises[exerciseId];

        if (!exercise) {
          return json(route, { error: "Exercise not found." }, 404);
        }

        return json(route, exercise);
      }

      const sessionMatch = pathname.match(
        /^\/api\/v1\/me\/workout-sessions\/([^/]+)$/,
      );

      if (sessionMatch && method === "GET") {
        const session = state.sessions.find(
          (item) => item.id === sessionMatch[1],
        );

        if (!session) {
          return json(route, { error: "Session not found." }, 404);
        }

        return json(route, session);
      }

      const setMatch = pathname.match(
        /^\/api\/v1\/me\/workout-sessions\/([^/]+)\/sets$/,
      );

      if (setMatch && method === "POST") {
        if (await fail(route, "createWorkoutSet")) {
          return;
        }

        const session = state.sessions.find((item) => item.id === setMatch[1]);

        if (!session) {
          return json(route, { error: "Session not found." }, 404);
        }

        const payload = request.postDataJSON() as {
          completed?: boolean;
          exerciseId: string;
          notes?: string | null;
          performedDistanceMeters?: number | null;
          performedDurationSeconds?: number | null;
          performedReps?: number | null;
          performedWeight?: number | null;
          performedWeightUnit?: string | null;
          restSecondsActual?: number | null;
          rpe?: number | null;
          sequence: number;
          setNumber: number;
          workoutTemplateExerciseId?: string | null;
        };
        const exercise = state.exercises[payload.exerciseId];
        const createdSet = buildWorkoutSet({
          completed: payload.completed ?? true,
          exercise: {
            id: payload.exerciseId,
            name: exercise?.name ?? "Exercise",
          },
          id: `set_created_${nextSetId}`,
          notes: payload.notes ?? null,
          performedDistanceMeters: payload.performedDistanceMeters ?? null,
          performedDurationSeconds: payload.performedDurationSeconds ?? null,
          performedReps: payload.performedReps ?? null,
          performedWeight: payload.performedWeight ?? null,
          performedWeightUnit: payload.performedWeightUnit ?? null,
          restSecondsActual: payload.restSecondsActual ?? null,
          rpe: payload.rpe ?? null,
          sequence: payload.sequence,
          setNumber: payload.setNumber,
          workoutSessionId: session.id,
          workoutTemplateExerciseId: payload.workoutTemplateExerciseId ?? null,
        });

        nextSetId += 1;
        session.sets = [...session.sets, createdSet].sort(
          (left, right) =>
            left.sequence - right.sequence || left.setNumber - right.setNumber,
        );
        return json(route, createdSet, 201);
      }

      const completeMatch = pathname.match(
        /^\/api\/v1\/me\/workout-sessions\/([^/]+)\/complete$/,
      );

      if (completeMatch && method === "POST") {
        if (await fail(route, "completeWorkoutSession")) {
          return;
        }

        const session = state.sessions.find(
          (item) => item.id === completeMatch[1],
        );

        if (!session) {
          return json(route, { error: "Session not found." }, 404);
        }

        const payload = request.postDataJSON() as {
          completedAt?: string;
          durationSeconds?: number | null;
        };

        session.completedAt = payload.completedAt ?? "2026-04-20T10:15:00.000Z";
        session.durationSeconds = payload.durationSeconds ?? 1800;
        session.status = "completed";
        return json(route, session);
      }

      const feedbackMatch = pathname.match(
        /^\/api\/v1\/me\/workout-sessions\/([^/]+)\/feedback$/,
      );

      if (feedbackMatch && method === "POST") {
        if (await fail(route, "feedback")) {
          return;
        }

        const session = state.sessions.find(
          (item) => item.id === feedbackMatch[1],
        );

        if (!session) {
          return json(route, { error: "Session not found." }, 404);
        }

        const payload = request.postDataJSON() as Partial<WorkoutFeedback>;
        const feedback = buildWorkoutFeedback({
          difficultyRating: payload.difficultyRating ?? null,
          energyRating: payload.energyRating ?? null,
          freeText: payload.freeText ?? null,
          id: `feedback_${session.id}`,
          mood: payload.mood ?? null,
          painFlag: payload.painFlag ?? false,
          painNotes: payload.painNotes ?? null,
          workoutSessionId: session.id,
        });

        session.feedback = feedback;
        return json(route, feedback);
      }

      return json(route, { error: `Unhandled ${method} ${pathname}` }, 500);
    } catch (error) {
      return json(
        route,
        {
          error:
            error instanceof Error ? error.message : "Unexpected mock error.",
        },
        500,
      );
    }
  });

  return state;
}
