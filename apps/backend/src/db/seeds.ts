import type { DatabaseSync } from "node:sqlite";

import type { AppEnv } from "../env.js";
import { hashAdminToken } from "../lib/admin-token.js";
import {
  seedExerciseCategories,
  seedExerciseMedia,
  seedExerciseSetLogs,
  seedExercises,
  seedTimestamps,
  seedWorkoutAssignments,
  seedWorkoutFeedback,
  seedWorkoutSessions,
  seedWorkoutTemplateExercises,
  seedWorkoutTemplates,
} from "./seed-data.js";

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function getTableColumns(db: DatabaseSync, tableName: string) {
  return new Set(
    (
      db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
}

function upsertAdminToken(db: DatabaseSync, env: AppEnv) {
  const tokenHash = hashAdminToken(env.ADMIN_SEED_TOKEN, {
    salt: `seed:${env.ADMIN_SEED_TOKEN_NAME}`,
  });
  const tokenPreview = env.ADMIN_SEED_TOKEN.slice(-6);
  const tokenScopes = stringifyJson(["admin:*"]);
  const columns = getTableColumns(db, "admin_tokens");

  if (columns.has("scopes_json")) {
    db.prepare(
      `
        INSERT INTO admin_tokens (
          id,
          name,
          token_hash,
          token_preview,
          scopes,
          scopes_json,
          last_used_at,
          expires_at,
          created_at,
          revoked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          token_hash = excluded.token_hash,
          token_preview = excluded.token_preview,
          scopes = excluded.scopes,
          scopes_json = excluded.scopes_json,
          revoked_at = NULL
      `,
    ).run(
      "admin_token_fitnaista_seed",
      env.ADMIN_SEED_TOKEN_NAME,
      tokenHash,
      tokenPreview,
      tokenScopes,
      tokenScopes,
      seedTimestamps.createdAt,
    );
  } else {
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
      tokenScopes,
      seedTimestamps.createdAt,
    );
  }

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
        is_active = excluded.is_active,
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

function upsertExerciseMedia(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO exercise_media (
        id,
        exercise_id,
        type,
        url,
        mime_type,
        duration_seconds,
        thumbnail_url,
        sort_order,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        exercise_id = excluded.exercise_id,
        type = excluded.type,
        url = excluded.url,
        mime_type = excluded.mime_type,
        duration_seconds = excluded.duration_seconds,
        thumbnail_url = excluded.thumbnail_url,
        sort_order = excluded.sort_order,
        created_at = excluded.created_at
    `,
  );

  for (const media of seedExerciseMedia) {
    statement.run(
      media.id,
      media.exerciseId,
      media.type,
      media.url,
      media.mimeType,
      media.durationSeconds,
      media.thumbnailUrl,
      media.sortOrder,
      media.createdAt,
    );
  }
}

function upsertWorkoutTemplates(db: DatabaseSync) {
  const statement = db.prepare(
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
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `,
  );

  for (const template of seedWorkoutTemplates) {
    statement.run(
      template.id,
      template.slug,
      template.name,
      template.description,
      template.goal,
      template.estimatedDurationMin,
      template.difficulty,
      seedTimestamps.createdAt,
      seedTimestamps.createdAt,
    );
  }
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
        target_reps,
        target_reps_min,
        target_reps_max,
        target_weight,
        target_weight_unit,
        target_duration_seconds,
        target_distance_meters,
        rest_seconds,
        tempo,
        rpe_target,
        rir_target,
        is_optional
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_template_id = excluded.workout_template_id,
        exercise_id = excluded.exercise_id,
        sequence = excluded.sequence,
        block_label = excluded.block_label,
        instruction_override = excluded.instruction_override,
        target_sets = excluded.target_sets,
        target_reps = excluded.target_reps,
        target_reps_min = excluded.target_reps_min,
        target_reps_max = excluded.target_reps_max,
        target_weight = excluded.target_weight,
        target_weight_unit = excluded.target_weight_unit,
        target_duration_seconds = excluded.target_duration_seconds,
        target_distance_meters = excluded.target_distance_meters,
        rest_seconds = excluded.rest_seconds,
        tempo = excluded.tempo,
        rpe_target = excluded.rpe_target,
        rir_target = excluded.rir_target,
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
      templateExercise.targetReps,
      templateExercise.targetRepsMin,
      templateExercise.targetRepsMax,
      templateExercise.targetWeight,
      templateExercise.targetWeightUnit,
      templateExercise.targetDurationSeconds,
      templateExercise.targetDistanceMeters,
      templateExercise.restSeconds,
      templateExercise.tempo,
      templateExercise.rpeTarget,
      templateExercise.rirTarget,
      Number(templateExercise.isOptional),
    );
  }
}

function upsertWorkoutAssignments(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO workout_assignments (
        id,
        workout_template_id,
        assigned_by,
        starts_on,
        ends_on,
        schedule_notes,
        frequency_per_week,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_template_id = excluded.workout_template_id,
        assigned_by = excluded.assigned_by,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        schedule_notes = excluded.schedule_notes,
        frequency_per_week = excluded.frequency_per_week,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `,
  );

  for (const assignment of seedWorkoutAssignments) {
    statement.run(
      assignment.id,
      assignment.workoutTemplateId,
      assignment.assignedBy,
      assignment.startsOn,
      assignment.endsOn,
      assignment.scheduleNotes,
      assignment.frequencyPerWeek,
      Number(assignment.isActive),
      assignment.createdAt,
      assignment.updatedAt,
    );
  }
}

function upsertWorkoutSessions(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO workout_sessions (
        id,
        workout_template_id,
        assignment_id,
        status,
        started_at,
        completed_at,
        duration_seconds,
        performed_version_snapshot,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_template_id = excluded.workout_template_id,
        assignment_id = excluded.assignment_id,
        status = excluded.status,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        duration_seconds = excluded.duration_seconds,
        performed_version_snapshot = excluded.performed_version_snapshot,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `,
  );

  for (const session of seedWorkoutSessions) {
    statement.run(
      session.id,
      session.workoutTemplateId,
      session.assignmentId,
      session.status,
      session.startedAt,
      session.completedAt,
      session.durationSeconds,
      stringifyJson(session.performedVersionSnapshot),
      session.notes,
      session.createdAt,
      session.updatedAt,
    );
  }
}

function upsertExerciseSetLogs(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO exercise_set_logs (
        id,
        workout_session_id,
        exercise_id,
        workout_template_exercise_id,
        sequence,
        set_number,
        performed_reps,
        performed_weight,
        performed_weight_unit,
        performed_duration_seconds,
        performed_distance_meters,
        rest_seconds_actual,
        rpe,
        completed,
        notes,
        logged_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_session_id = excluded.workout_session_id,
        exercise_id = excluded.exercise_id,
        workout_template_exercise_id = excluded.workout_template_exercise_id,
        sequence = excluded.sequence,
        set_number = excluded.set_number,
        performed_reps = excluded.performed_reps,
        performed_weight = excluded.performed_weight,
        performed_weight_unit = excluded.performed_weight_unit,
        performed_duration_seconds = excluded.performed_duration_seconds,
        performed_distance_meters = excluded.performed_distance_meters,
        rest_seconds_actual = excluded.rest_seconds_actual,
        rpe = excluded.rpe,
        completed = excluded.completed,
        notes = excluded.notes,
        logged_at = excluded.logged_at
    `,
  );

  for (const setLog of seedExerciseSetLogs) {
    statement.run(
      setLog.id,
      setLog.workoutSessionId,
      setLog.exerciseId,
      setLog.workoutTemplateExerciseId,
      setLog.sequence,
      setLog.setNumber,
      setLog.performedReps,
      setLog.performedWeight,
      setLog.performedWeightUnit,
      setLog.performedDurationSeconds,
      setLog.performedDistanceMeters,
      setLog.restSecondsActual,
      setLog.rpe,
      Number(setLog.completed),
      setLog.notes,
      setLog.loggedAt,
    );
  }
}

function upsertWorkoutFeedback(db: DatabaseSync) {
  const statement = db.prepare(
    `
      INSERT INTO workout_feedback (
        id,
        workout_session_id,
        mood,
        difficulty_rating,
        energy_rating,
        pain_flag,
        pain_notes,
        free_text,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workout_session_id = excluded.workout_session_id,
        mood = excluded.mood,
        difficulty_rating = excluded.difficulty_rating,
        energy_rating = excluded.energy_rating,
        pain_flag = excluded.pain_flag,
        pain_notes = excluded.pain_notes,
        free_text = excluded.free_text,
        submitted_at = excluded.submitted_at
    `,
  );

  for (const feedback of seedWorkoutFeedback) {
    statement.run(
      feedback.id,
      feedback.workoutSessionId,
      feedback.mood,
      feedback.difficultyRating,
      feedback.energyRating,
      Number(feedback.painFlag),
      feedback.painNotes,
      feedback.freeText,
      feedback.submittedAt,
    );
  }
}

function resetSeedData(db: DatabaseSync) {
  db.exec(`
    DELETE FROM auth_challenges;
    DELETE FROM athlete_sessions;
    DELETE FROM workout_feedback;
    DELETE FROM exercise_set_logs;
    DELETE FROM workout_sessions;
    DELETE FROM workout_assignments;
    DELETE FROM workout_template_exercises;
    DELETE FROM workout_templates;
    DELETE FROM exercise_media;
    DELETE FROM exercises;
    DELETE FROM exercise_categories;
    DELETE FROM athlete_passkey;
  `);
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
    resetSeedData(db);
    const adminToken = upsertAdminToken(db, env);
    upsertExerciseCategories(db);
    upsertExercises(db);
    upsertExerciseMedia(db);
    upsertWorkoutTemplates(db);
    upsertWorkoutTemplateExercises(db);
    upsertWorkoutAssignments(db);
    upsertWorkoutSessions(db);
    upsertExerciseSetLogs(db);
    upsertWorkoutFeedback(db);
    db.exec("COMMIT");

    return {
      adminToken,
      counts: {
        assignments: getCount(db, "workout_assignments"),
        exerciseCategories: getCount(db, "exercise_categories"),
        exerciseMedia: getCount(db, "exercise_media"),
        exercises: getCount(db, "exercises"),
        feedback: getCount(db, "workout_feedback"),
        sessions: getCount(db, "workout_sessions"),
        workoutTemplates: getCount(db, "workout_templates"),
      },
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
