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

export type SeedExerciseMedia = {
  createdAt: string;
  durationSeconds: number | null;
  exerciseId: string;
  id: string;
  mimeType: string | null;
  sortOrder: number;
  thumbnailUrl: string | null;
  type: "image" | "video";
  url: string;
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
  targetDistanceMeters: number | null;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetRepsMin: number | null;
  targetSets: number | null;
  targetWeight: number | null;
  targetWeightUnit: string | null;
  tempo: string | null;
  rirTarget: number | null;
  workoutTemplateId: string;
};

export type SeedWorkoutAssignment = {
  assignedBy: string;
  createdAt: string;
  endsOn: string | null;
  frequencyPerWeek: number | null;
  id: string;
  isActive: boolean;
  scheduleNotes: string | null;
  startsOn: string;
  updatedAt: string;
  workoutTemplateId: string;
};

export type SeedWorkoutSession = {
  assignmentId: string | null;
  completedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
  id: string;
  notes: string | null;
  performedVersionSnapshot: Record<string, unknown>;
  startedAt: string;
  status: "abandoned" | "completed" | "in_progress" | "planned";
  updatedAt: string;
  workoutTemplateId: string;
};

export type SeedExerciseSetLog = {
  completed: boolean;
  exerciseId: string;
  id: string;
  loggedAt: string;
  notes: string | null;
  performedDistanceMeters: number | null;
  performedDurationSeconds: number | null;
  performedReps: number | null;
  performedWeight: number | null;
  performedWeightUnit: string | null;
  restSecondsActual: number | null;
  rpe: number | null;
  sequence: number;
  setNumber: number;
  workoutSessionId: string;
  workoutTemplateExerciseId: string | null;
};

export type SeedWorkoutFeedback = {
  difficultyRating: number | null;
  energyRating: number | null;
  freeText: string | null;
  id: string;
  mood: string | null;
  painFlag: boolean;
  painNotes: string | null;
  submittedAt: string;
  workoutSessionId: string;
};
