import type {
  SeedExercise,
  SeedExerciseCategory,
  SeedWorkoutTemplate,
  SeedWorkoutTemplateExercise,
} from "./schema.js";

export const seedTimestamps = {
  assignedOn: "2026-01-01",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const seedUser = {
  createdAt: seedTimestamps.createdAt,
  displayName: "Arnau",
  id: "user_arnau",
  status: "active" as const,
  updatedAt: seedTimestamps.createdAt,
};

export const seedExerciseCategories: SeedExerciseCategory[] = [
  {
    id: "cat_strength",
    name: "Strength",
    description:
      "Foundational resistance work tracked by sets, reps, and load.",
  },
  {
    id: "cat_mobility",
    name: "Mobility",
    description:
      "Joint prep and movement quality work used in warmups and cooldowns.",
  },
  {
    id: "cat_core",
    name: "Core",
    description: "Trunk stability and posture-focused accessory work.",
  },
];

export const seedExercises: SeedExercise[] = [
  {
    id: "exercise_goblet_squat",
    slug: "goblet-squat",
    name: "Goblet Squat",
    categoryId: "cat_strength",
    description:
      "A stable squat pattern that keeps setup simple for early progression.",
    instructions:
      "Hold one dumbbell at chest height, brace, sit between the hips, and stand without letting the chest collapse.",
    equipment: ["dumbbell", "bench"],
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["core", "adductors"],
  },
  {
    id: "exercise_incline_push_up",
    slug: "incline-push-up",
    name: "Incline Push-Up",
    categoryId: "cat_strength",
    description:
      "Upper-body pressing with a scalable setup for consistent full range reps.",
    instructions:
      "Hands on a bench or box, body in a straight line, lower under control, then press back to full extension.",
    equipment: ["bench"],
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["chest", "triceps"],
    secondaryMuscles: ["front delts", "core"],
  },
  {
    id: "exercise_split_stance_row",
    slug: "split-stance-row",
    name: "Split Stance Dumbbell Row",
    categoryId: "cat_strength",
    description:
      "Single-arm pulling pattern for upper back strength and posture.",
    instructions:
      "Support one hand on a bench, keep hips square, and row the dumbbell to the lower ribs without twisting.",
    equipment: ["dumbbell", "bench"],
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["lats", "mid-back"],
    secondaryMuscles: ["rear delts", "biceps"],
  },
  {
    id: "exercise_worlds_greatest_stretch",
    slug: "worlds-greatest-stretch",
    name: "World's Greatest Stretch",
    categoryId: "cat_mobility",
    description:
      "Dynamic mobility sequence covering hips, thoracic rotation, and hamstrings.",
    instructions:
      "Step into a long lunge, reach one arm up for rotation, switch sides deliberately, and keep breathing steady.",
    equipment: ["bodyweight"],
    trackingMode: "time",
    difficulty: "beginner",
    primaryMuscles: ["hips", "thoracic-spine"],
    secondaryMuscles: ["hamstrings", "shoulders"],
  },
  {
    id: "exercise_dead_bug",
    slug: "dead-bug",
    name: "Dead Bug",
    categoryId: "cat_core",
    description:
      "Core drill that teaches trunk stiffness and breathing under limb movement.",
    instructions:
      "Press lower back into the floor, move opposite arm and leg slowly, and reset before the spine loses contact.",
    equipment: ["bodyweight"],
    trackingMode: "reps",
    difficulty: "beginner",
    primaryMuscles: ["core"],
    secondaryMuscles: ["hip flexors", "shoulders"],
  },
];

export const seedWorkoutTemplate: SeedWorkoutTemplate = {
  id: "template_foundation_a",
  slug: "foundation-a",
  name: "Foundation Session A",
  description:
    "Simple full-body baseline session for establishing quality movement patterns.",
  goal: "Baseline strength and movement quality",
  estimatedDurationMin: 35,
  difficulty: "beginner",
};

export const seedWorkoutTemplateExercises: SeedWorkoutTemplateExercise[] = [
  {
    id: "template_foundation_a_worlds_greatest_stretch",
    workoutTemplateId: seedWorkoutTemplate.id,
    exerciseId: "exercise_worlds_greatest_stretch",
    sequence: 1,
    blockLabel: "warmup",
    instructionOverride:
      "Move continuously for the full interval and keep the transitions smooth.",
    targetSets: 1,
    targetRepsMin: null,
    targetRepsMax: null,
    targetDurationSeconds: 120,
    restSeconds: 30,
    tempo: null,
    rpeTarget: null,
    isOptional: false,
  },
  {
    id: "template_foundation_a_goblet_squat",
    workoutTemplateId: seedWorkoutTemplate.id,
    exerciseId: "exercise_goblet_squat",
    sequence: 2,
    blockLabel: "main",
    instructionOverride:
      "Choose a load that leaves around two reps in reserve while staying upright.",
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetDurationSeconds: null,
    restSeconds: 90,
    tempo: "3-1-1",
    rpeTarget: 7,
    isOptional: false,
  },
  {
    id: "template_foundation_a_incline_push_up",
    workoutTemplateId: seedWorkoutTemplate.id,
    exerciseId: "exercise_incline_push_up",
    sequence: 3,
    blockLabel: "main",
    instructionOverride:
      "Raise the hands if needed to keep every rep strict and pain free.",
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetDurationSeconds: null,
    restSeconds: 75,
    tempo: "2-1-1",
    rpeTarget: 7,
    isOptional: false,
  },
  {
    id: "template_foundation_a_split_stance_row",
    workoutTemplateId: seedWorkoutTemplate.id,
    exerciseId: "exercise_split_stance_row",
    sequence: 4,
    blockLabel: "main",
    instructionOverride:
      "Pause briefly at the top so the shoulder blade finishes the rep.",
    targetSets: 3,
    targetRepsMin: 10,
    targetRepsMax: 12,
    targetDurationSeconds: null,
    restSeconds: 75,
    tempo: "2-1-2",
    rpeTarget: 7,
    isOptional: false,
  },
  {
    id: "template_foundation_a_dead_bug",
    workoutTemplateId: seedWorkoutTemplate.id,
    exerciseId: "exercise_dead_bug",
    sequence: 5,
    blockLabel: "cooldown",
    instructionOverride:
      "Slow each rep down and reset the breath between sides.",
    targetSets: 2,
    targetRepsMin: 6,
    targetRepsMax: 8,
    targetDurationSeconds: null,
    restSeconds: 30,
    tempo: null,
    rpeTarget: 6,
    isOptional: false,
  },
];
