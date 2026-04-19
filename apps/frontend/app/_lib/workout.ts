import type {
  WorkoutSessionDetail,
  WorkoutSetLog,
  WorkoutTemplateExercise,
} from "./types";

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds < 1) {
    return "0:00";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatClock(isoDate: string | null | undefined) {
  if (!isoDate) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function formatSessionDate(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(isoDate));
}

export function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

export function describeExerciseTarget(exercise: WorkoutTemplateExercise) {
  const parts: string[] = [];

  if (exercise.targetSets) {
    parts.push(`${exercise.targetSets} sets`);
  }

  if (exercise.targetReps) {
    parts.push(`${exercise.targetReps} reps`);
  } else if (exercise.targetRepsMin || exercise.targetRepsMax) {
    const min = exercise.targetRepsMin ?? exercise.targetRepsMax;
    const max = exercise.targetRepsMax ?? exercise.targetRepsMin;
    parts.push(`${min}-${max} reps`);
  }

  if (exercise.targetDurationSeconds) {
    parts.push(`${formatDuration(exercise.targetDurationSeconds)}`);
  }

  if (exercise.targetDistanceMeters) {
    parts.push(`${exercise.targetDistanceMeters} m`);
  }

  if (exercise.targetWeight) {
    parts.push(
      `${exercise.targetWeight}${exercise.targetWeightUnit ? ` ${exercise.targetWeightUnit}` : ""}`,
    );
  }

  return parts.join(" · ") || "Open tracking";
}

export function setsForExercise(
  session: WorkoutSessionDetail,
  templateExerciseId: string,
) {
  return session.sets
    .filter((set) => set.workoutTemplateExerciseId === templateExerciseId)
    .sort((left, right) => left.setNumber - right.setNumber);
}

export function countCompletedExercises(
  plan: WorkoutTemplateExercise[],
  session: WorkoutSessionDetail,
) {
  return plan.filter((exercise) => isExerciseComplete(exercise, session))
    .length;
}

export function isExerciseComplete(
  exercise: WorkoutTemplateExercise,
  session: WorkoutSessionDetail,
) {
  const sets = setsForExercise(session, exercise.id);
  const targetSets = exercise.targetSets ?? 1;
  return sets.filter((set) => set.completed).length >= targetSets;
}

export function getNextIncompleteExerciseIndex(
  plan: WorkoutTemplateExercise[],
  session: WorkoutSessionDetail,
) {
  const index = plan.findIndex(
    (exercise) => !isExerciseComplete(exercise, session),
  );
  return index === -1 ? plan.length - 1 : index;
}

export function getSuggestedSetValues(
  exercise: WorkoutTemplateExercise,
  sets: WorkoutSetLog[],
) {
  const lastSet = sets.at(-1);
  const targetRepMidpoint =
    exercise.targetReps ??
    (exercise.targetRepsMin && exercise.targetRepsMax
      ? Math.round((exercise.targetRepsMin + exercise.targetRepsMax) / 2)
      : (exercise.targetRepsMin ?? exercise.targetRepsMax ?? null));

  return {
    durationSeconds:
      lastSet?.performedDurationSeconds ??
      exercise.targetDurationSeconds ??
      null,
    distanceMeters:
      lastSet?.performedDistanceMeters ?? exercise.targetDistanceMeters ?? null,
    reps: lastSet?.performedReps ?? targetRepMidpoint,
    rpe: lastSet?.rpe ?? exercise.rpeTarget ?? null,
    weight: lastSet?.performedWeight ?? exercise.targetWeight ?? null,
    weightUnit:
      lastSet?.performedWeightUnit ?? exercise.targetWeightUnit ?? null,
  };
}

export function getSessionElapsedSeconds(session: WorkoutSessionDetail) {
  const endTime =
    session.completedAt && session.status === "completed"
      ? new Date(session.completedAt).getTime()
      : Date.now();
  const startTime = new Date(session.startedAt).getTime();

  if (!Number.isFinite(startTime)) {
    return 0;
  }

  return Math.max(0, Math.round((endTime - startTime) / 1000));
}
