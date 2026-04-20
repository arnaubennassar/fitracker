import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../app.js";
import { seedDatabase } from "../db/seeds.js";
import { createTestEnv } from "../test-helpers.js";
import {
  countWorkoutFeedbackBySessionFilters,
  countWorkoutSessions,
  getWorkoutFeedbackForSession,
  getWorkoutSessionDetail,
  getWorkoutSessionRow,
  listWorkoutFeedback,
  listWorkoutSessionRows,
  mapWorkoutFeedbackRow,
  mapWorkoutSessionSetLogRow,
  summarizeWorkoutSessions,
} from "./workout-sessions.js";

test("set-log and feedback mappers normalize sqlite rows", () => {
  assert.equal(
    mapWorkoutSessionSetLogRow({
      completed: 1,
      exercise_id: "exercise_goblet_squat",
      exercise_name: "Goblet squat",
      id: "set_1",
      logged_at: "2026-04-20T09:00:00.000Z",
      notes: "Strong",
      performed_distance_meters: null,
      performed_duration_seconds: null,
      performed_reps: 10,
      performed_weight: 20,
      performed_weight_unit: "kg",
      rest_seconds_actual: 60,
      rpe: 7,
      sequence: 1,
      set_number: 1,
      workout_session_id: "session_1",
      workout_template_exercise_id: "wte_1",
    }).completed,
    true,
  );

  assert.equal(
    mapWorkoutFeedbackRow({
      difficulty_rating: 7,
      energy_rating: 4,
      free_text: "Felt steady.",
      id: "feedback_1",
      mood: "good",
      pain_flag: 0,
      pain_notes: null,
      submitted_at: "2026-04-20T10:00:00.000Z",
      user_id: "user_arnau",
      workout_session_id: "session_1",
    })?.painFlag,
    false,
  );
  assert.equal(mapWorkoutFeedbackRow(undefined), null);
});

test("workout session repo supports filtering, invalid snapshot fallback, and reporting summaries", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    app.db
      .prepare(
        `
          UPDATE workout_sessions
          SET performed_version_snapshot = 'not-json'
          WHERE id = 'session_foundation_a_2026_01_10'
        `,
      )
      .run();

    const single = getWorkoutSessionRow(app.db, {
      sessionId: "session_foundation_a_2026_01_10",
      userId: "user_arnau",
    });
    const paged = listWorkoutSessionRows(
      app.db,
      { userId: "user_arnau" },
      { limit: 1, offset: 1 },
    );
    const detail = getWorkoutSessionDetail(app.db, {
      sessionId: "session_foundation_a_2026_01_10",
      userId: "user_arnau",
    });
    const feedback = listWorkoutFeedback(
      app.db,
      { userId: "user_arnau" },
      { limit: 10, offset: 0 },
    );

    assert.ok(single);
    assert.deepEqual(single?.performedVersionSnapshot, {});
    assert.equal(paged.length, 1);
    assert.ok(detail);
    assert.equal(detail?.setLogs.length, 5);
    assert.equal(detail?.feedback?.difficultyRating, 7);
    assert.equal(countWorkoutSessions(app.db, { userId: "user_arnau" }), 2);
    assert.deepEqual(
      summarizeWorkoutSessions(app.db, { userId: "user_arnau" }),
      {
        abandonedSessions: 1,
        completedSessions: 1,
        inProgressSessions: 0,
        plannedSessions: 0,
      },
    );
    assert.equal(feedback.total, 1);
    assert.equal(feedback.items[0]?.id, "feedback_foundation_a_2026_01_10");
    assert.equal(
      countWorkoutFeedbackBySessionFilters(app.db, { userId: "user_arnau" }),
      1,
    );
    assert.equal(
      getWorkoutFeedbackForSession(app.db, "session_foundation_a_2026_01_10")
        ?.id,
      "feedback_foundation_a_2026_01_10",
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});
