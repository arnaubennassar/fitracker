export type AuthSession = {
  authenticated: boolean;
  session: {
    expiresAt: string;
    id: string;
    lastSeenAt: string;
  } | null;
  user: {
    displayName: string;
    id: string;
    status: string;
  } | null;
};

export type WorkoutTemplateSummary = {
  description: string | null;
  difficulty: string | null;
  estimatedDurationMin: number | null;
  goal: string | null;
  id: string;
  name: string;
  slug: string;
};

export type WorkoutAssignment = {
  assignedBy: string;
  createdAt: string;
  endsOn: string | null;
  frequencyPerWeek: number | null;
  id: string;
  isActive: boolean;
  scheduleNotes: string | null;
  startsOn: string;
  workoutTemplate: WorkoutTemplateSummary;
};

export type ExerciseSummary = {
  description: string | null;
  difficulty: string;
  id: string;
  name: string;
  slug: string;
  trackingMode: "distance" | "mixed" | "reps" | "time";
};

export type WorkoutTemplateExercise = {
  blockLabel: string;
  exercise: ExerciseSummary;
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

export type ExerciseMedia = {
  durationSeconds: number | null;
  id: string;
  mimeType: string | null;
  sortOrder: number;
  thumbnailUrl: string | null;
  type: "image" | "video" | string;
  url: string;
};

export type ExerciseDetail = {
  category: {
    id: string;
    name: string;
  };
  description: string | null;
  difficulty: string;
  equipment: string[];
  id: string;
  instructions: string;
  isActive: boolean;
  media: ExerciseMedia[];
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  slug: string;
  trackingMode: "distance" | "mixed" | "reps" | "time";
};

export type WorkoutSetLog = {
  completed: boolean;
  exercise: {
    id: string;
    name: string;
  };
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

export type WorkoutFeedback = {
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

export type WorkoutSessionDetail = {
  assignmentId: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  feedback: WorkoutFeedback | null;
  id: string;
  notes: string | null;
  sets: WorkoutSetLog[];
  startedAt: string;
  status: "planned" | "in_progress" | "completed" | "abandoned";
  workoutTemplate: {
    id: string;
    name: string;
    slug: string;
  };
};

export type WorkoutSessionListResponse = {
  items: WorkoutSessionDetail[];
  limit: number;
  offset: number;
  total: number;
};

export type TodayWorkoutsResponse = {
  date: string;
  items: WorkoutAssignment[];
};

export type WorkoutAssignmentsResponse = {
  items: WorkoutAssignment[];
};

export type WorkoutExercisesResponse = {
  items: ExerciseDetail[];
};

export type CreateSetPayload = {
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

export type FeedbackPayload = {
  difficultyRating?: number | null;
  energyRating?: number | null;
  freeText?: string | null;
  mood?: string | null;
  painFlag?: boolean;
  painNotes?: string | null;
};
