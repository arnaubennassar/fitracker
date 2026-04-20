import { vi } from "vitest";

export const apiMocks = {
  apiFetch: vi.fn(),
  completeWorkoutSession: vi.fn(),
  createWorkoutSession: vi.fn(),
  createWorkoutSet: vi.fn(),
  getAuthSession: vi.fn(),
  getExerciseDetail: vi.fn(),
  getTodayWorkouts: vi.fn(),
  getWorkoutDetail: vi.fn(),
  getWorkoutSession: vi.fn(),
  listWorkoutSessions: vi.fn(),
  logoutUser: vi.fn(),
  submitWorkoutFeedback: vi.fn(),
};

export function resetApiMocks() {
  for (const mockFn of Object.values(apiMocks)) {
    mockFn.mockReset();
  }
}
