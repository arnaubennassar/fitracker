import type {
  AuthSession,
  ExerciseDetail,
  TodayWorkoutsResponse,
  WorkoutAssignment,
  WorkoutFeedback,
  WorkoutSessionDetail,
  WorkoutSessionListResponse,
  WorkoutSetLog,
  WorkoutTemplateDetail,
  WorkoutTemplateExercise,
  WorkoutTemplateSummary,
} from "../app/_lib/types";

const DEFAULT_TIMESTAMP = "2026-04-20T09:00:00.000Z";

export function buildAuthSession(
  overrides: Partial<AuthSession> = {},
): AuthSession {
  return {
    authenticated: true,
    session: {
      expiresAt: "2026-04-21T09:00:00.000Z",
      id: "session_cookie",
      lastSeenAt: DEFAULT_TIMESTAMP,
    },
    user: {
      displayName: "Arnau Bennassar",
      id: "user_arnau",
      status: "active",
    },
    ...overrides,
  };
}

export function buildWorkoutTemplateSummary(
  overrides: Partial<WorkoutTemplateSummary> = {},
): WorkoutTemplateSummary {
  return {
    description: "Main session",
    difficulty: "beginner",
    estimatedDurationMin: 40,
    goal: "Strength",
    id: "template_foundation_a",
    name: "Foundation Session A",
    slug: "foundation-session-a",
    ...overrides,
  };
}

export function buildWorkoutAssignment(
  overrides: Partial<WorkoutAssignment> = {},
): WorkoutAssignment {
  return {
    assignedBy: "coach_fitnaista",
    createdAt: DEFAULT_TIMESTAMP,
    endsOn: null,
    frequencyPerWeek: 2,
    id: "assignment_foundation_a",
    isActive: true,
    scheduleNotes: "Stay smooth through each block.",
    startsOn: "2026-04-20",
    workoutTemplate: buildWorkoutTemplateSummary(),
    ...overrides,
  };
}

export function buildWorkoutTemplateExercise(
  overrides: Partial<WorkoutTemplateExercise> = {},
): WorkoutTemplateExercise {
  return {
    blockLabel: "main",
    exercise: {
      description: "Brace and squat.",
      difficulty: "beginner",
      id: "exercise_goblet_squat",
      name: "Goblet squat",
      slug: "goblet-squat",
      trackingMode: "reps",
    },
    id: "wte_goblet_squat",
    instructionOverride: null,
    isOptional: false,
    restSeconds: 60,
    rirTarget: null,
    rpeTarget: 7,
    sequence: 1,
    targetDistanceMeters: null,
    targetDurationSeconds: null,
    targetReps: null,
    targetRepsMax: 12,
    targetRepsMin: 10,
    targetSets: 3,
    targetWeight: 20,
    targetWeightUnit: "kg",
    tempo: null,
    workoutTemplateId: "template_foundation_a",
    ...overrides,
  };
}

export function buildWorkoutTemplateDetail(
  overrides: Partial<WorkoutTemplateDetail> = {},
): WorkoutTemplateDetail {
  return {
    ...buildWorkoutTemplateSummary(),
    exercises: [
      buildWorkoutTemplateExercise(),
      buildWorkoutTemplateExercise({
        blockLabel: "accessory",
        exercise: {
          description: "Step back and row.",
          difficulty: "beginner",
          id: "exercise_split_stance_row",
          name: "Split stance row",
          slug: "split-stance-row",
          trackingMode: "mixed",
        },
        id: "wte_split_stance_row",
        restSeconds: 45,
        sequence: 2,
        targetReps: 10,
        targetRepsMax: null,
        targetRepsMin: null,
        targetSets: 2,
        targetWeight: 18,
      }),
    ],
    ...overrides,
  };
}

export function buildExerciseDetail(
  overrides: Partial<ExerciseDetail> = {},
): ExerciseDetail {
  return {
    category: {
      id: "cat_strength",
      name: "Strength",
    },
    description: "A stable squat pattern.",
    difficulty: "beginner",
    equipment: ["dumbbell"],
    id: "exercise_goblet_squat",
    instructions: "Brace and squat.",
    isActive: true,
    media: [],
    name: "Goblet squat",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
    slug: "goblet-squat",
    trackingMode: "reps",
    ...overrides,
  };
}

export function buildWorkoutSet(
  overrides: Partial<WorkoutSetLog> = {},
): WorkoutSetLog {
  return {
    completed: true,
    exercise: {
      id: "exercise_goblet_squat",
      name: "Goblet squat",
    },
    id: "set_1",
    loggedAt: DEFAULT_TIMESTAMP,
    notes: null,
    performedDistanceMeters: null,
    performedDurationSeconds: null,
    performedReps: 10,
    performedWeight: 20,
    performedWeightUnit: "kg",
    restSecondsActual: null,
    rpe: 7,
    sequence: 1,
    setNumber: 1,
    workoutSessionId: "session_foundation_a",
    workoutTemplateExerciseId: "wte_goblet_squat",
    ...overrides,
  };
}

export function buildWorkoutFeedback(
  overrides: Partial<WorkoutFeedback> = {},
): WorkoutFeedback {
  return {
    difficultyRating: 7,
    energyRating: 4,
    freeText: "Felt steady.",
    id: "feedback_foundation_a",
    mood: "good",
    painFlag: false,
    painNotes: null,
    submittedAt: "2026-04-20T09:45:00.000Z",
    workoutSessionId: "session_foundation_a",
    ...overrides,
  };
}

export function buildWorkoutSession(
  overrides: Partial<WorkoutSessionDetail> = {},
): WorkoutSessionDetail {
  return {
    assignmentId: "assignment_foundation_a",
    completedAt: null,
    durationSeconds: null,
    feedback: null,
    id: "session_foundation_a",
    notes: null,
    sets: [],
    startedAt: DEFAULT_TIMESTAMP,
    status: "in_progress",
    workoutTemplate: {
      id: "template_foundation_a",
      name: "Foundation Session A",
      slug: "foundation-session-a",
    },
    ...overrides,
  };
}

export function buildTodayWorkoutsResponse(
  overrides: Partial<TodayWorkoutsResponse> = {},
): TodayWorkoutsResponse {
  return {
    date: "2026-04-20",
    items: [buildWorkoutAssignment()],
    ...overrides,
  };
}

export function buildWorkoutSessionListResponse(
  items: WorkoutSessionDetail[],
  overrides: Partial<WorkoutSessionListResponse> = {},
): WorkoutSessionListResponse {
  return {
    items,
    limit: items.length || 1,
    offset: 0,
    total: items.length,
    ...overrides,
  };
}
