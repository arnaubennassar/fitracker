const RUNNER_STORAGE_PREFIX = "fitracker.runner.";

export type PersistedRunnerState = {
  currentExerciseIndex: number;
  exerciseTimerEndsAt: number | null;
  exerciseTimerExerciseId: string | null;
  exerciseTimerSeconds: number | null;
  restTimerEndsAt: number | null;
  updatedAt: number;
};

export function loadRunnerState(sessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(
    `${RUNNER_STORAGE_PREFIX}${sessionId}`,
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedRunnerState;
  } catch {
    return null;
  }
}

export function saveRunnerState(
  sessionId: string,
  state: PersistedRunnerState,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    `${RUNNER_STORAGE_PREFIX}${sessionId}`,
    JSON.stringify(state),
  );
}

export function clearRunnerState(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(`${RUNNER_STORAGE_PREFIX}${sessionId}`);
}
