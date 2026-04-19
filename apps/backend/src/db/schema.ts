export type AdminTokenRow = {
  created_at: string;
  expires_at: string | null;
  id: string;
  last_used_at: string | null;
  name: string;
  revoked_at: string | null;
  scopes: string;
  token_hash: string;
  token_preview: string;
};

export type SeedExerciseCategory = {
  description: string;
  id: string;
  name: string;
};

export type SeedExercise = {
  categoryId: string;
  description: string;
  difficulty: "advanced" | "beginner" | "intermediate";
  equipment: string[];
  id: string;
  instructions: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  slug: string;
  trackingMode: "distance" | "mixed" | "reps" | "time";
};

export type SeedWorkoutTemplate = {
  description: string;
  difficulty: "advanced" | "beginner" | "intermediate";
  estimatedDurationMin: number;
  goal: string;
  id: string;
  name: string;
  slug: string;
};

export type SeedWorkoutTemplateExercise = {
  blockLabel: string;
  exerciseId: string;
  id: string;
  instructionOverride: string | null;
  isOptional: boolean;
  restSeconds: number | null;
  rpeTarget: number | null;
  sequence: number;
  targetDurationSeconds: number | null;
  targetRepsMax: number | null;
  targetRepsMin: number | null;
  targetSets: number | null;
  tempo: string | null;
  workoutTemplateId: string;
};
