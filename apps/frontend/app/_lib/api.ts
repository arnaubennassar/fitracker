import type {
  AuthSession,
  CreateSetPayload,
  ExerciseDetail,
  FeedbackPayload,
  TodayWorkoutsResponse,
  WorkoutAssignmentsResponse,
  WorkoutFeedback,
  WorkoutSessionDetail,
  WorkoutSessionListResponse,
  WorkoutSetLog,
  WorkoutTemplateDetail,
} from "./types";

const API_BASE = "/api/v1";

export class ApiError extends Error {
  statusCode: number;
  code: string | undefined;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

type FetchOptions = RequestInit & {
  bodyJson?: unknown;
};

async function parseResponse<T>(response: Response) {
  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  const payload = text
    ? (JSON.parse(text) as T | { code?: string; error?: string })
    : null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object"
        ? (payload as { code?: string; error?: string })
        : { error: response.statusText };
    throw new ApiError(
      errorPayload.error ?? "Request failed.",
      response.status,
      errorPayload.code,
    );
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}) {
  const headers = new Headers(options.headers);
  const requestOptions: RequestInit = {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers,
  };

  if (options.bodyJson !== undefined) {
    headers.set("content-type", "application/json");
    requestOptions.body = JSON.stringify(options.bodyJson);
  } else if (options.body !== undefined) {
    requestOptions.body = options.body;
  }

  const response = await fetch(`${API_BASE}${path}`, requestOptions);

  return parseResponse<T>(response);
}

export function getAuthSession() {
  return apiFetch<AuthSession>("/auth/me");
}

export function logoutUser() {
  return apiFetch<{ authenticated: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export function getTodayWorkouts() {
  return apiFetch<TodayWorkoutsResponse>("/me/workouts/today");
}

export function getWorkoutAssignments() {
  return apiFetch<WorkoutAssignmentsResponse>("/me/workouts");
}

export function getWorkoutDetail(workoutId: string) {
  return apiFetch<WorkoutTemplateDetail>(`/me/workouts/${workoutId}`);
}

export function getExerciseDetail(exerciseId: string) {
  return apiFetch<ExerciseDetail>(`/me/exercises/${exerciseId}`);
}

export function listWorkoutSessions(params?: {
  limit?: number;
  offset?: number;
  status?: "planned" | "in_progress" | "completed" | "abandoned";
}) {
  const search = new URLSearchParams();

  if (params?.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params?.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  if (params?.status) {
    search.set("status", params.status);
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : "";

  return apiFetch<WorkoutSessionListResponse>(`/me/workout-sessions${suffix}`);
}

export function createWorkoutSession(payload: {
  assignmentId?: string | null;
  notes?: string | null;
  workoutTemplateId: string;
}) {
  return apiFetch<WorkoutSessionDetail>("/me/workout-sessions", {
    bodyJson: payload,
    method: "POST",
  });
}

export function getWorkoutSession(sessionId: string) {
  return apiFetch<WorkoutSessionDetail>(`/me/workout-sessions/${sessionId}`);
}

export function patchWorkoutSession(
  sessionId: string,
  payload: {
    completedAt?: string | null;
    durationSeconds?: number | null;
    notes?: string | null;
    startedAt?: string;
    status?: "planned" | "in_progress" | "completed" | "abandoned";
  },
) {
  return apiFetch<WorkoutSessionDetail>(`/me/workout-sessions/${sessionId}`, {
    bodyJson: payload,
    method: "PATCH",
  });
}

export function createWorkoutSet(sessionId: string, payload: CreateSetPayload) {
  return apiFetch<WorkoutSetLog>(`/me/workout-sessions/${sessionId}/sets`, {
    bodyJson: payload,
    method: "POST",
  });
}

export function completeWorkoutSession(
  sessionId: string,
  payload: {
    completedAt?: string;
    durationSeconds?: number | null;
    notes?: string | null;
  },
) {
  return apiFetch<WorkoutSessionDetail>(
    `/me/workout-sessions/${sessionId}/complete`,
    {
      bodyJson: payload,
      method: "POST",
    },
  );
}

export function submitWorkoutFeedback(
  sessionId: string,
  payload: FeedbackPayload,
) {
  return apiFetch<WorkoutFeedback>(
    `/me/workout-sessions/${sessionId}/feedback`,
    {
      bodyJson: payload,
      method: "POST",
    },
  );
}
