import type { DatabaseSync } from "node:sqlite";

import type { AppEnv } from "../env.js";
import { hashAdminToken } from "../lib/admin-token.js";
import {
  seedExerciseCategories,
  seedExercises,
  seedTimestamps,
  seedUser,
  seedWorkoutTemplate,
  seedWorkoutTemplateExercises,
} from "./seed-data.js";

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function upsertUser(db: DatabaseSync) {
  db.prepare(
    `
      INSERT INTO users (id, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        updated_at = excluded.updated_at
    `,
  ).run(
    seedUser.id,
    seedUser.displayName,
    seedUser.status,
    seedUser.createdAt,
    seedUser.updatedAt,
  );
}

function upsertAdminToken(db: DatabaseSync, env: AppEnv) {
  const tokenHash = hashAdminToken(env.ADMIN_SEED_TOKEN, {
    salt: `seed:${env.ADMIN_SEED_TOKEN_NAME}`,
  });
  const tokenPreview = env.ADMIN_SEED_TOKEN.slice(-6);

  db.prepare(
    `
      INSERT INTO admin_tokens (
        id,
        name,
        token_hash,
        token_preview,
        scopes,
        last_used_at,
        expires_at,
        created_at,
        revoked_at
      )
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        token_hash = excluded.token_hash,
        token_preview = excluded.token_preview,
        scopes = excluded.scopes,
        revoked_at = NULL
    `,
  ).run(
    "admin_token_fitnaista_seed",
    env.ADMIN_SEED_TOKEN_NAME,
    tokenHash,
    tokenPreview,
    stringifyJson(["admin:*"]),
    seedTimestamps.createdAt,
  );

  return {
    id: "admin_token_fitnaista_seed",
    name: env.ADMIN_SEED_TOKEN_NAME,
    preview: tokenPreview,
  };
}

function upsertExerciseCategories(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO exercise_categories (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description
    `,
  );

  for (const category of seedExerciseCategories) {
    statement.run(category.id, category.name, category.description);
  }
}

function upsertExercises(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO exercises (
        id,
        slug,
        name,
        category_id,
        description,
        instructions,
        equipment,
        tracking_mode,
        difficulty,
        primary_muscles,
        secondary_muscles,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        category_id = excluded.category_id,
        description = excluded.description,
        instructions = excluded.instructions,
        equipment = excluded.equipment,
        tracking_mode = excluded.tracking_mode,
        difficulty = excluded.difficulty,
        primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles,
        updated_at = excluded.updated_at
    `,
  );

  for (const exercise of seedExercises) {
    statement.run(
      exercise.id,
      exercise.slug,
      exercise.name,
      exercise.categoryId,
      exercise.description,
      exercise.instructions,
      stringifyJson(exercise.equipment),
      exercise.trackingMode,
      exercise.difficulty,
      stringifyJson(exercise.primaryMuscles),
      stringifyJson(exercise.secondaryMuscles),
      seedTimestamps.createdAt,
      seedTimestamps.createdAt,
    );
  }
}

function upsertWorkoutTemplate(db: DatabaseSync) {
  db.prepare(
    `
      INSERT INTO workout_templates (
        id,
        slug,
        name,
        description,
        goal,
        estimated_duration_min,
        difficulty,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        description = excluded.description,
        goal = excluded.goal,
        estimated_duration_min = excluded.estimated_duration_min,
        difficulty = excluded.difficulty,
        updated_at = excluded.updated_at
    `,
  ).run(
    seedWorkoutTemplate.id,
    seedWorkoutTemplate.slug,
    seedWorkoutTemplate.name,
    seedWorkoutTemplate.description,
    seedWorkoutTemplate.goal,
    seedWorkoutTemplate.estimatedDurationMin,
    seedWorkoutTemplate.difficulty,
    seedTimestamps.createdAt,
    seedTimestamps.createdAt,
  );
}

function upsertWorkoutTemplateExercises(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO workout_template_exercises (
        id,
        workout_template_id,
        exercise_id,
        sequence,
        block_label,
        instruction_override,
        target_sets,
        target_reps_min,
        target_reps_max,
        target_duration_seconds,
        rest_seconds,
        tempo,
        rpe_target,
        is_optional
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_template_id = excluded.workout_template_id,
        exercise_id = excluded.exercise_id,
        sequence = excluded.sequence,
        block_label = excluded.block_label,
        instruction_override = excluded.instruction_override,
        target_sets = excluded.target_sets,
        target_reps_min = excluded.target_reps_min,
        target_reps_max = excluded.target_reps_max,
        target_duration_seconds = excluded.target_duration_seconds,
        rest_seconds = excluded.rest_seconds,
        tempo = excluded.tempo,
        rpe_target = excluded.rpe_target,
        is_optional = excluded.is_optional
    `,
  );

  for (const templateExercise of seedWorkoutTemplateExercises) {
    statement.run(
      templateExercise.id,
      templateExercise.workoutTemplateId,
      templateExercise.exerciseId,
      templateExercise.sequence,
      templateExercise.blockLabel,
      templateExercise.instructionOverride,
      templateExercise.targetSets,
      templateExercise.targetRepsMin,
      templateExercise.targetRepsMax,
      templateExercise.targetDurationSeconds,
      templateExercise.restSeconds,
      templateExercise.tempo,
      templateExercise.rpeTarget,
      Number(templateExercise.isOptional),
    );
  }
}

function upsertWorkoutAssignment(db: DatabaseSync) {
  db.prepare(
    `
      INSERT INTO workout_plan_assignments (
        id,
        user_id,
        workout_plan_id,
        workout_template_id,
        assigned_by,
        starts_on,
        ends_on,
        schedule_notes,
        is_active
      )
      VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        workout_template_id = excluded.workout_template_id,
        assigned_by = excluded.assigned_by,
        starts_on = excluded.starts_on,
        schedule_notes = excluded.schedule_notes,
        is_active = excluded.is_active
    `,
  ).run(
    "assignment_foundation_a",
    seedUser.id,
    seedWorkoutTemplate.id,
    "fitnaista",
    seedTimestamps.assignedOn,
    "Repeat this session twice per week until the first real program lands.",
  );
}

function getCount(db: DatabaseSync, tableName: string) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get() as {
    count: number;
  };

  return row.count;
}

export function seedDatabase(db: DatabaseSync, env: AppEnv) {
  db.exec("BEGIN");

  try {
    upsertUser(db);
    const adminToken = upsertAdminToken(db, env);
    upsertExerciseCategories(db);
    upsertExercises(db);
    upsertWorkoutTemplate(db);
    upsertWorkoutTemplateExercises(db);
    upsertWorkoutAssignment(db);
    db.exec("COMMIT");

    return {
      adminToken,
      counts: {
        exerciseCategories: getCount(db, "exercise_categories"),
        exercises: getCount(db, "exercises"),
        users: getCount(db, "users"),
        workoutTemplates: getCount(db, "workout_templates"),
      },
      user: {
        id: seedUser.id,
      },
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
