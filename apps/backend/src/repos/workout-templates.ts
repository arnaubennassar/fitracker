import type { DatabaseSync } from "node:sqlite";

type WorkoutTemplateRow = {
  created_at: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate" | null;
  estimated_duration_min: number | null;
  exercise_count?: number;
  goal: string | null;
  id: string;
  is_active: number;
  name: string;
  slug: string;
  updated_at: string;
};

type WorkoutTemplateExerciseRow = {
  block_label: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate";
  exercise_id: string;
  exercise_name: string;
  exercise_slug: string;
  id: string;
  instruction_override: string | null;
  is_optional: number;
  rest_seconds: number | null;
  rir_target: number | null;
  rpe_target: number | null;
  sequence: number;
  target_distance_meters: number | null;
  target_duration_seconds: number | null;
  target_reps: number | null;
  target_reps_max: number | null;
  target_reps_min: number | null;
  target_sets: number | null;
  target_weight: number | null;
  target_weight_unit: string | null;
  tempo: string | null;
  tracking_mode: "distance" | "mixed" | "reps" | "time";
  workout_template_id: string;
};

export type WorkoutTemplateSummary = {
  createdAt: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate" | null;
  estimatedDurationMin: number | null;
  exerciseCount: number;
  goal: string | null;
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
  updatedAt: string;
};

export type WorkoutTemplateExercise = {
  blockLabel: string;
  exercise: {
    description: string | null;
    difficulty: "advanced" | "beginner" | "intermediate";
    id: string;
    name: string;
    slug: string;
    trackingMode: "distance" | "mixed" | "reps" | "time";
  };
  id: string;
  instructionOverride: string | null;
  isOptional: boolean;
  restSeconds: number | null;
  rirTarget: number | null;
  rpeTarget: number | null;
  sequence: number;
  targetDistanceMeters: number | null;
  targetDurationSeconds: number | null;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetRepsMin: number | null;
  targetSets: number | null;
  targetWeight: number | null;
  targetWeightUnit: string | null;
  tempo: string | null;
  workoutTemplateId: string;
};

export type WorkoutTemplateDetail = WorkoutTemplateSummary & {
  exercises: WorkoutTemplateExercise[];
};

function toBoolean(value: number | null | undefined) {
  return value === 1;
}

export function mapWorkoutTemplateRow(
  row: WorkoutTemplateRow,
): WorkoutTemplateSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    goal: row.goal,
    estimatedDurationMin: row.estimated_duration_min,
    difficulty: row.difficulty,
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exerciseCount: row.exercise_count ?? 0,
  };
}

export function mapWorkoutTemplateExerciseRow(
  row: WorkoutTemplateExerciseRow,
): WorkoutTemplateExercise {
  return {
    id: row.id,
    workoutTemplateId: row.workout_template_id,
    exercise: {
      id: row.exercise_id,
      name: row.exercise_name,
      slug: row.exercise_slug,
      trackingMode: row.tracking_mode,
      difficulty: row.difficulty,
      description: row.description,
    },
    sequence: row.sequence,
    blockLabel: row.block_label,
    instructionOverride: row.instruction_override,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    targetWeight: row.target_weight,
    targetWeightUnit: row.target_weight_unit,
    targetDurationSeconds: row.target_duration_seconds,
    targetDistanceMeters: row.target_distance_meters,
    restSeconds: row.rest_seconds,
    tempo: row.tempo,
    rpeTarget: row.rpe_target,
    rirTarget: row.rir_target,
    isOptional: toBoolean(row.is_optional),
  };
}

export function getWorkoutTemplateSummary(
  db: DatabaseSync,
  workoutId: string,
): WorkoutTemplateSummary | null {
  const row = db
    .prepare(
      `
        SELECT workout_templates.*, COUNT(workout_template_exercises.id) AS exercise_count
        FROM workout_templates
        LEFT JOIN workout_template_exercises
          ON workout_template_exercises.workout_template_id = workout_templates.id
        WHERE workout_templates.id = ?
        GROUP BY workout_templates.id
      `,
    )
    .get(workoutId) as WorkoutTemplateRow | undefined;

  return row ? mapWorkoutTemplateRow(row) : null;
}

export function getWorkoutTemplateExercises(
  db: DatabaseSync,
  workoutId: string,
): WorkoutTemplateExercise[] {
  const rows = db
    .prepare(
      `
        SELECT
          workout_template_exercises.*,
          exercises.slug AS exercise_slug,
          exercises.name AS exercise_name,
          exercises.tracking_mode,
          exercises.difficulty,
          exercises.description
        FROM workout_template_exercises
        INNER JOIN exercises
          ON exercises.id = workout_template_exercises.exercise_id
        WHERE workout_template_exercises.workout_template_id = ?
        ORDER BY sequence ASC, id ASC
      `,
    )
    .all(workoutId) as WorkoutTemplateExerciseRow[];

  return rows.map(mapWorkoutTemplateExerciseRow);
}

export function getWorkoutTemplateDetail(
  db: DatabaseSync,
  workoutId: string,
): WorkoutTemplateDetail | null {
  const template = getWorkoutTemplateSummary(db, workoutId);

  if (!template) {
    return null;
  }

  return {
    ...template,
    exercises: getWorkoutTemplateExercises(db, workoutId),
  };
}
