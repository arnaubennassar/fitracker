import { describe, expect, test } from "vitest";

import type {
  WorkoutSessionDetail,
  WorkoutSetLog,
  WorkoutTemplateExercise,
} from "./types";
import {
  describeExerciseTarget,
  formatDuration,
  getNextIncompleteExerciseIndex,
  getSuggestedSetValues,
  isExerciseComplete,
} from "./workout";

const exercise: WorkoutTemplateExercise = {
  blockLabel: "main",
  exercise: {
    description: "",
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
  workoutTemplateId: "template_a",
};

const baseSet: WorkoutSetLog = {
  completed: true,
  exercise: { id: exercise.exercise.id, name: exercise.exercise.name },
  id: "set_1",
  loggedAt: "2026-04-20T09:00:00.000Z",
  notes: null,
  performedDistanceMeters: null,
  performedDurationSeconds: null,
  performedReps: 11,
  performedWeight: 22,
  performedWeightUnit: "kg",
  restSecondsActual: 55,
  rpe: 8,
  sequence: 1,
  setNumber: 1,
  workoutSessionId: "session_1",
  workoutTemplateExerciseId: exercise.id,
};

function cloneSet(overrides: Partial<WorkoutSetLog>): WorkoutSetLog {
  return {
    ...baseSet,
    ...overrides,
  };
}

const session: WorkoutSessionDetail = {
  assignmentId: "assignment_1",
  completedAt: null,
  durationSeconds: null,
  feedback: null,
  id: "session_1",
  notes: null,
  sets: [baseSet],
  startedAt: "2026-04-20T09:00:00.000Z",
  status: "in_progress",
  workoutTemplate: {
    id: "template_a",
    name: "Lower A",
    slug: "lower-a",
  },
};

describe("workout helpers", () => {
  test("formats durations and targets for runner UI", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(describeExerciseTarget(exercise)).toBe(
      "3 sets · 10-12 reps · 20 kg",
    );
  });

  test("suggests the previous set and detects completion", () => {
    expect(getSuggestedSetValues(exercise, session.sets).weight).toBe(22);
    expect(isExerciseComplete(exercise, session)).toBe(false);

    const completedSession: WorkoutSessionDetail = {
      ...session,
      sets: [
        ...session.sets,
        cloneSet({ id: "set_2", setNumber: 2 }),
        cloneSet({ id: "set_3", setNumber: 3 }),
      ],
    };

    expect(isExerciseComplete(exercise, completedSession)).toBe(true);
    expect(getNextIncompleteExerciseIndex([exercise], completedSession)).toBe(
      0,
    );
  });
});
