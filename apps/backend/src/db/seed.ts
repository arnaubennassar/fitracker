import { env } from "../env.js";
import { hashToken } from "../lib/crypto.js";
import { nowIso } from "../lib/time.js";
import { getDb } from "./client.js";

const arnauUserId = "user_arnau";
const adminTokenId = "admin_token_primary";
const templateId = "workout_full_body_a";

const categories = [
  {
    id: "category_strength",
    name: "Strength",
    description: "Main strength work and accessory lifts.",
  },
  {
    id: "category_mobility",
    name: "Mobility",
    description: "Warmup and movement quality drills.",
  },
];

const exercises = [
  {
    id: "exercise_goblet_squat",
    slug: "goblet-squat",
    categoryId: "category_strength",
    name: "Goblet Squat",
    description: "Simple squat pattern with dumbbell or kettlebell.",
    instructions: "Brace, keep chest tall, and control the descent.",
    equipment: "dumbbell,kettlebell",
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["core"],
  },
  {
    id: "exercise_push_up",
    slug: "push-up",
    categoryId: "category_strength",
    name: "Push-Up",
    description: "Bodyweight horizontal press.",
    instructions: "Keep ribs down and body in one line.",
    equipment: "bodyweight",
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["chest", "triceps"],
    secondaryMuscles: ["shoulders", "core"],
  },
  {
    id: "exercise_dead_bug",
    slug: "dead-bug",
    categoryId: "category_mobility",
    name: "Dead Bug",
    description: "Core control drill for warmup or cooldown.",
    instructions: "Keep lower back gently pinned and exhale each rep.",
    equipment: "bodyweight",
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["core"],
    secondaryMuscles: ["hip flexors"],
  },
];

const templateExercises = [
  {
    id: "workout_full_body_a_entry_1",
    exerciseId: "exercise_dead_bug",
    sequence: 1,
    blockLabel: "warmup",
    targetSets: 2,
    targetReps: "8/side",
    restSeconds: 30,
  },
  {
    id: "workout_full_body_a_entry_2",
    exerciseId: "exercise_goblet_squat",
    sequence: 2,
    blockLabel: "main",
    targetSets: 4,
    targetReps: "8-10",
    restSeconds: 90,
  },
  {
    id: "workout_full_body_a_entry_3",
    exerciseId: "exercise_push_up",
    sequence: 3,
    blockLabel: "main",
    targetSets: 3,
    targetReps: "8-12",
    restSeconds: 75,
  },
];

export function seedDatabase() {
  const db = getDb();
  const seedNow = nowIso();

  db.prepare(
    `INSERT INTO users (id, display_name, status, created_at, updated_at)
     VALUES (?, ?, 'active', ?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`,
  ).run(arnauUserId, "Arnau", seedNow, seedNow);

  db.prepare(
    `INSERT INTO admin_tokens (id, name, token_hash, scopes_json, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET token_hash = excluded.token_hash, scopes_json = excluded.scopes_json`,
  ).run(
    adminTokenId,
    "Primary development admin token",
    hashToken(env.ADMIN_SEED_TOKEN),
    JSON.stringify(["admin:*"]),
    seedNow,
  );

  for (const category of categories) {
    db.prepare(
      `INSERT INTO exercise_categories (id, name, description)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description`,
    ).run(category.id, category.name, category.description);
  }

  for (const exercise of exercises) {
    db.prepare(
      `INSERT INTO exercises (
        id, slug, category_id, name, description, instructions, equipment,
        tracking_mode, difficulty, primary_muscles_json, secondary_muscles_json,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        category_id = excluded.category_id,
        name = excluded.name,
        description = excluded.description,
        instructions = excluded.instructions,
        equipment = excluded.equipment,
        tracking_mode = excluded.tracking_mode,
        difficulty = excluded.difficulty,
        primary_muscles_json = excluded.primary_muscles_json,
        secondary_muscles_json = excluded.secondary_muscles_json,
        updated_at = excluded.updated_at`,
    ).run(
      exercise.id,
      exercise.slug,
      exercise.categoryId,
      exercise.name,
      exercise.description,
      exercise.instructions,
      exercise.equipment,
      exercise.trackingMode,
      exercise.difficulty,
      JSON.stringify(exercise.primaryMuscles),
      JSON.stringify(exercise.secondaryMuscles),
      seedNow,
      seedNow,
    );
  }

  db.prepare(
    `INSERT INTO workout_templates (
      id, name, description, goal, estimated_duration_min, difficulty,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      goal = excluded.goal,
      estimated_duration_min = excluded.estimated_duration_min,
      difficulty = excluded.difficulty,
      updated_at = excluded.updated_at`,
  ).run(
    templateId,
    "Full Body A",
    "Starter full body session for local verification.",
    "Build baseline strength with low setup friction.",
    40,
    "beginner",
    seedNow,
    seedNow,
  );

  db.prepare(
    "DELETE FROM workout_template_exercises WHERE workout_template_id = ?",
  ).run(templateId);

  for (const entry of templateExercises) {
    db.prepare(
      `INSERT INTO workout_template_exercises (
        id, workout_template_id, exercise_id, sequence, block_label,
        target_sets, target_reps, rest_seconds, is_optional
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      entry.id,
      templateId,
      entry.exerciseId,
      entry.sequence,
      entry.blockLabel,
      entry.targetSets,
      entry.targetReps,
      entry.restSeconds,
    );
  }

  return {
    userId: arnauUserId,
    adminToken: env.ADMIN_SEED_TOKEN,
    workoutTemplateId: templateId,
  };
}
