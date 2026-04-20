import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../app.js";
import { seedDatabase } from "../db/seeds.js";
import { createTestEnv } from "../test-helpers.js";
import {
  getWorkoutTemplateDetail,
  getWorkoutTemplateSummary,
  mapWorkoutTemplateExerciseRow,
  mapWorkoutTemplateRow,
} from "./workout-templates.js";

test("mapWorkoutTemplateRow and mapWorkoutTemplateExerciseRow normalize sqlite fields", () => {
  assert.deepEqual(
    mapWorkoutTemplateRow({
      created_at: "2026-04-20T09:00:00.000Z",
      description: "Main session",
      difficulty: "beginner",
      estimated_duration_min: 40,
      exercise_count: 2,
      goal: "Strength",
      id: "template_foundation_a",
      is_active: 1,
      name: "Foundation Session A",
      slug: "foundation-session-a",
      updated_at: "2026-04-20T09:00:00.000Z",
    }),
    {
      createdAt: "2026-04-20T09:00:00.000Z",
      description: "Main session",
      difficulty: "beginner",
      estimatedDurationMin: 40,
      exerciseCount: 2,
      goal: "Strength",
      id: "template_foundation_a",
      isActive: true,
      name: "Foundation Session A",
      slug: "foundation-session-a",
      updatedAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.equal(
    mapWorkoutTemplateExerciseRow({
      block_label: "main",
      description: "Brace and squat.",
      difficulty: "beginner",
      exercise_id: "exercise_goblet_squat",
      exercise_name: "Goblet squat",
      exercise_slug: "goblet-squat",
      id: "wte_goblet_squat",
      instruction_override: null,
      is_optional: 0,
      rest_seconds: 60,
      rir_target: null,
      rpe_target: 7,
      sequence: 1,
      target_distance_meters: null,
      target_duration_seconds: null,
      target_reps: null,
      target_reps_max: 12,
      target_reps_min: 10,
      target_sets: 3,
      target_weight: 20,
      target_weight_unit: "kg",
      tempo: null,
      tracking_mode: "reps",
      workout_template_id: "template_foundation_a",
    }).isOptional,
    false,
  );
});

test("workout template repo returns seeded summaries and details", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const summary = getWorkoutTemplateSummary(app.db, "template_foundation_a");
    const detail = getWorkoutTemplateDetail(app.db, "template_foundation_a");

    assert.ok(summary);
    assert.equal(summary?.exerciseCount, 5);
    assert.ok(detail);
    assert.equal(detail?.exercises.length, 5);
    assert.equal(
      detail?.exercises[0]?.exercise.name,
      "World's Greatest Stretch",
    );
    assert.equal(getWorkoutTemplateDetail(app.db, "template_missing"), null);
  } finally {
    await app.close();
    context.cleanup();
  }
});
