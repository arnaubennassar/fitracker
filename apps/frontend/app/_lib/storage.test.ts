import { beforeEach, describe, expect, test } from "vitest";

import { clearRunnerState, loadRunnerState, saveRunnerState } from "./storage";

const sessionId = "session_test";
const state = {
  currentExerciseIndex: 2,
  exerciseTimerEndsAt: 12345,
  exerciseTimerExerciseId: "exercise_1",
  exerciseTimerSeconds: 90,
  restTimerEndsAt: 67890,
  updatedAt: 11111,
};

describe("runner storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("persists and clears runner state", () => {
    saveRunnerState(sessionId, state);
    expect(loadRunnerState(sessionId)).toEqual(state);

    clearRunnerState(sessionId);
    expect(loadRunnerState(sessionId)).toBeNull();
  });

  test("ignores broken persisted JSON", () => {
    window.localStorage.setItem("fitracker.runner.session_test", "{broken");
    expect(loadRunnerState(sessionId)).toBeNull();
  });
});
