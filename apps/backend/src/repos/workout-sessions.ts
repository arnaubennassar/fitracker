import type { DatabaseSync } from "node:sqlite";

type WorkoutSessionRow = {
  assignment_id: string | null;
  completed_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  id: string;
  notes: string | null;
  performed_version_snapshot: string;
  started_at: string;
  status: string;
  template_name: string;
  template_slug: string;
  updated_at: string;
  user_display_name: string;
  user_id: string;
  workout_template_id: string;
};

type WorkoutSessionSetLogRow = {
  completed: number;
  exercise_id: string;
  exercise_name: string;
  id: string;
  logged_at: string;
  notes: string | null;
  performed_distance_meters: number | null;
  performed_duration_seconds: number | null;
  performed_reps: number | null;
  performed_weight: number | null;
  performed_weight_unit: string | null;
  rest_seconds_actual: number | null;
  rpe: number | null;
  sequence: number;
  set_number: number;
  workout_session_id: string;
  workout_template_exercise_id: string | null;
};

type WorkoutFeedbackRow = {
  difficulty_rating: number | null;
  energy_rating: number | null;
  free_text: string | null;
  id: string;
  mood: string | null;
  pain_flag: number;
  pain_notes: string | null;
  submitted_at: string;
  user_id: string;
  workout_session_id: string;
};

export type WorkoutSessionFilters = {
  sessionId?: string;
  status?: string;
  userId?: string;
};

export type WorkoutSessionSummary = {
  assignmentId: string | null;
  completedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
  id: string;
  notes: string | null;
  performedVersionSnapshot: Record<string, unknown>;
  startedAt: string;
  status: string;
  updatedAt: string;
  user: {
    displayName: string;
    id: string;
  };
  workoutTemplate: {
    id: string;
    name: string;
    slug: string;
  };
};

export type WorkoutSessionSetLog = {
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
  userId: string;
  workoutSessionId: string;
};

export type WorkoutSessionDetail = WorkoutSessionSummary & {
  feedback: WorkoutFeedback | null;
  setLogs: WorkoutSessionSetLog[];
};

function toBoolean(value: number | null | undefined) {
  return value === 1;
}

function parseJson<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildSessionWhereClause(filters: WorkoutSessionFilters) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.sessionId) {
    conditions.push("workout_sessions.id = ?");
    params.push(filters.sessionId);
  }

  if (filters.userId) {
    conditions.push("workout_sessions.user_id = ?");
    params.push(filters.userId);
  }

  if (filters.status) {
    conditions.push("workout_sessions.status = ?");
    params.push(filters.status);
  }

  return {
    params,
    whereClause: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
  };
}

function getSessionBaseQuery() {
  return `
    SELECT
      workout_sessions.*,
      users.display_name AS user_display_name,
      workout_templates.name AS template_name,
      workout_templates.slug AS template_slug
    FROM workout_sessions
    INNER JOIN users ON users.id = workout_sessions.user_id
    INNER JOIN workout_templates
      ON workout_templates.id = workout_sessions.workout_template_id
  `;
}

function mapWorkoutSessionRow(row: WorkoutSessionRow): WorkoutSessionSummary {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    performedVersionSnapshot: parseJson(row.performed_version_snapshot, {}),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      displayName: row.user_display_name,
    },
    workoutTemplate: {
      id: row.workout_template_id,
      name: row.template_name,
      slug: row.template_slug,
    },
  };
}

export function mapWorkoutSessionSetLogRow(
  row: WorkoutSessionSetLogRow,
): WorkoutSessionSetLog {
  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    workoutTemplateExerciseId: row.workout_template_exercise_id,
    exercise: {
      id: row.exercise_id,
      name: row.exercise_name,
    },
    sequence: row.sequence,
    setNumber: row.set_number,
    performedReps: row.performed_reps,
    performedWeight: row.performed_weight,
    performedWeightUnit: row.performed_weight_unit,
    performedDurationSeconds: row.performed_duration_seconds,
    performedDistanceMeters: row.performed_distance_meters,
    restSecondsActual: row.rest_seconds_actual,
    rpe: row.rpe,
    completed: toBoolean(row.completed),
    notes: row.notes,
    loggedAt: row.logged_at,
  };
}

export function mapWorkoutFeedbackRow(
  row: WorkoutFeedbackRow | undefined,
): WorkoutFeedback | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    userId: row.user_id,
    mood: row.mood,
    difficultyRating: row.difficulty_rating,
    energyRating: row.energy_rating,
    painFlag: toBoolean(row.pain_flag),
    painNotes: row.pain_notes,
    freeText: row.free_text,
    submittedAt: row.submitted_at,
  };
}

export function getWorkoutSessionRow(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
): WorkoutSessionSummary | null {
  const { whereClause, params } = buildSessionWhereClause(filters);
  const row = db
    .prepare(`${getSessionBaseQuery()}${whereClause} LIMIT 1`)
    .get(...params) as WorkoutSessionRow | undefined;

  return row ? mapWorkoutSessionRow(row) : null;
}

export function listWorkoutSessionRows(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
  pagination: { limit: number; offset: number },
): WorkoutSessionSummary[] {
  const { whereClause, params } = buildSessionWhereClause(filters);
  const rows = db
    .prepare(
      `${getSessionBaseQuery()}${whereClause} ORDER BY workout_sessions.started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pagination.limit, pagination.offset) as WorkoutSessionRow[];

  return rows.map(mapWorkoutSessionRow);
}

export function countWorkoutSessions(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
) {
  const { whereClause, params } = buildSessionWhereClause(filters);
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM workout_sessions${whereClause}`)
    .get(...params) as { count: number };

  return row.count;
}

export function summarizeWorkoutSessions(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
) {
  const { whereClause, params } = buildSessionWhereClause(filters);
  const row = db
    .prepare(
      `
        SELECT
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedSessions,
          SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS plannedSessions,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgressSessions,
          SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandonedSessions
        FROM workout_sessions
        ${whereClause}
      `,
    )
    .get(...params) as Record<string, number | null>;

  return {
    abandonedSessions: row.abandonedSessions ?? 0,
    completedSessions: row.completedSessions ?? 0,
    inProgressSessions: row.inProgressSessions ?? 0,
    plannedSessions: row.plannedSessions ?? 0,
  };
}

export function listWorkoutSessionSetLogs(
  db: DatabaseSync,
  sessionId: string,
): WorkoutSessionSetLog[] {
  const rows = db
    .prepare(
      `
        SELECT
          exercise_set_logs.*,
          exercises.name AS exercise_name
        FROM exercise_set_logs
        INNER JOIN exercises ON exercises.id = exercise_set_logs.exercise_id
        WHERE workout_session_id = ?
        ORDER BY sequence ASC, set_number ASC
      `,
    )
    .all(sessionId) as WorkoutSessionSetLogRow[];

  return rows.map(mapWorkoutSessionSetLogRow);
}

export function getWorkoutFeedbackForSession(
  db: DatabaseSync,
  sessionId: string,
) {
  const row = db
    .prepare("SELECT * FROM workout_feedback WHERE workout_session_id = ?")
    .get(sessionId) as WorkoutFeedbackRow | undefined;

  return mapWorkoutFeedbackRow(row);
}

export function getWorkoutSessionDetail(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
): WorkoutSessionDetail | null {
  const session = getWorkoutSessionRow(db, filters);

  if (!session) {
    return null;
  }

  return {
    ...session,
    feedback: getWorkoutFeedbackForSession(db, session.id),
    setLogs: listWorkoutSessionSetLogs(db, session.id),
  };
}

export function listWorkoutFeedback(
  db: DatabaseSync,
  filters: { userId?: string },
  pagination: { limit: number; offset: number },
) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.userId) {
    conditions.push("workout_feedback.user_id = ?");
    params.push(filters.userId);
  }

  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";
  const items = db
    .prepare(
      `
        SELECT *
        FROM workout_feedback
        ${whereClause}
        ORDER BY submitted_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(
      ...params,
      pagination.limit,
      pagination.offset,
    ) as WorkoutFeedbackRow[];
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM workout_feedback${whereClause}`)
    .get(...params) as { count: number };

  return {
    items: items.map((item) => mapWorkoutFeedbackRow(item)).filter(Boolean),
    total: total.count,
  };
}

export function countWorkoutFeedbackBySessionFilters(
  db: DatabaseSync,
  filters: WorkoutSessionFilters,
) {
  const { whereClause, params } = buildSessionWhereClause(filters);
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM workout_feedback
        INNER JOIN workout_sessions
          ON workout_sessions.id = workout_feedback.workout_session_id
        ${whereClause}
      `,
    )
    .get(...params) as { count: number };

  return row.count;
}
