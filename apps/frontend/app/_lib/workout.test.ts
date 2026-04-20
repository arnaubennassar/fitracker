import { describe, expect, test } from "vitest";

import type {
  WorkoutSessionDetail,
  WorkoutSetLog,
  WorkoutTemplateExercise,
} from "./types";
import {
  clampNumber,
  countCompletedExercises,
  describeExerciseTarget,
  formatClock,
  formatDuration,
  formatSessionDate,
  getNextIncompleteExerciseIndex,
  getSessionElapsedSeconds,
  getSuggestedSetValues,
  isExerciseComplete,
  setsForExercise,
  titleCase,
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

const secondaryExercise: WorkoutTemplateExercise = {
  ...exercise,
  blockLabel: "accessory-work",
  exercise: {
    description: "",
    difficulty: "beginner",
    id: "exercise_split_stance_row",
    name: "Split stance row",
    slug: "split-stance-row",
    trackingMode: "mixed",
  },
  id: "wte_split_stance_row",
  restSeconds: 45,
  sequence: 2,
  targetReps: 8,
  targetRepsMax: null,
  targetRepsMin: null,
  targetSets: 2,
  targetWeight: 18,
};

describe("workout helpers", () => {
  test("formats durations and targets for runner UI", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(describeExerciseTarget(exercise)).toBe(
      "3 sets · 10-12 reps · 20 kg",
    );
    expect(formatClock(null)).toBe("Not set");
    expect(formatClock("2026-04-20T09:05:00.000Z")).toBe(
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date("2026-04-20T09:05:00.000Z")),
    );
    expect(formatSessionDate("2026-04-20T09:05:00.000Z")).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        weekday: "short",
      }).format(new Date("2026-04-20T09:05:00.000Z")),
    );
    expect(titleCase("accessory-work_block")).toBe("Accessory Work Block");
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

  test("clamps values and groups sets by exercise in order", () => {
    const unorderedSets = [
      cloneSet({
        id: "set_2",
        setNumber: 2,
        workoutTemplateExerciseId: exercise.id,
      }),
      cloneSet({
        id: "set_other",
        sequence: 2,
        setNumber: 1,
        workoutTemplateExerciseId: secondaryExercise.id,
      }),
      cloneSet({
        id: "set_1",
        setNumber: 1,
        workoutTemplateExerciseId: exercise.id,
      }),
    ];
    const filtered = setsForExercise(
      {
        ...session,
        sets: unorderedSets,
      },
      exercise.id,
    );

    expect(clampNumber(-4, 0, 5)).toBe(0);
    expect(clampNumber(9, 0, 5)).toBe(5);
    expect(filtered.map((setItem) => setItem.id)).toEqual(["set_1", "set_2"]);
  });

  test("counts completed exercises and finds the next incomplete block", () => {
    const completedSession: WorkoutSessionDetail = {
      ...session,
      sets: [
        cloneSet({ id: "set_1", workoutTemplateExerciseId: exercise.id }),
        cloneSet({
          id: "set_2",
          setNumber: 2,
          workoutTemplateExerciseId: exercise.id,
        }),
        cloneSet({
          id: "set_3",
          setNumber: 3,
          workoutTemplateExerciseId: exercise.id,
        }),
        cloneSet({
          id: "set_4",
          exercise: {
            id: secondaryExercise.exercise.id,
            name: secondaryExercise.exercise.name,
          },
          sequence: 2,
          setNumber: 1,
          workoutTemplateExerciseId: secondaryExercise.id,
        }),
      ],
    };

    expect(
      countCompletedExercises([exercise, secondaryExercise], completedSession),
    ).toBe(1);
    expect(
      getNextIncompleteExerciseIndex(
        [exercise, secondaryExercise],
        completedSession,
      ),
    ).toBe(1);
  });

  test("uses target fallbacks when no prior set exists", () => {
    const timeExercise = {
      ...secondaryExercise,
      exercise: {
        ...secondaryExercise.exercise,
        trackingMode: "time" as const,
      },
      targetDistanceMeters: 250,
      targetDurationSeconds: 90,
      targetReps: null,
      targetRepsMax: 10,
      targetRepsMin: 6,
      targetSets: 1,
      targetWeight: null,
      targetWeightUnit: null,
    };

    expect(getSuggestedSetValues(timeExercise, [])).toEqual({
      distanceMeters: 250,
      durationSeconds: 90,
      reps: 8,
      rpe: 7,
      weight: null,
      weightUnit: null,
    });
  });

  test("calculates elapsed seconds for active, complete, and invalid sessions", () => {
    const startedAt = "2026-04-20T09:00:00.000Z";
    const realNow = Date.now;

    Date.now = () => new Date("2026-04-20T09:02:30.000Z").getTime();

    expect(getSessionElapsedSeconds({ ...session, startedAt })).toBe(150);
    expect(
      getSessionElapsedSeconds({
        ...session,
        completedAt: "2026-04-20T09:10:00.000Z",
        startedAt,
        status: "completed",
      }),
    ).toBe(600);
    expect(
      getSessionElapsedSeconds({
        ...session,
        startedAt: "invalid-date",
      }),
    ).toBe(0);

    Date.now = realNow;
  });
});
