import type { FastifyReply, FastifyRequest } from "fastify";

import { requireAdminAuth } from "../auth.js";
import type { AppRouteDefinition } from "../registry.js";
import { buildRouteSchema } from "../registry.js";
import type { AdminRouteOptions, PaginationQuery } from "./shared.js";
import {
  buildListResponseSchema,
  dateTimeSchema,
  errorResponseSchema,
  getPagination,
  idParamSchema,
  nullableIntegerSchema,
  nullableNumberSchema,
  nullableStringSchema,
  paginationQuerySchema,
  parseJson,
  sendNotFound,
  toBoolean,
} from "./shared.js";

type SessionRow = {
  assignment_id: string | null;
  completed_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  feedback_id: string | null;
  id: string;
  notes: string | null;
  performed_version_snapshot: string;
  started_at: string;
  status: string;
  updated_at: string;
  user_display_name: string;
  user_id: string;
  workout_name: string;
  workout_slug: string;
  workout_template_id: string;
};
type SetLogRow = {
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
  workout_template_exercise_id: string | null;
};
type FeedbackRow = {
  assignment_id: string | null;
  energy_level: number | null;
  id: string;
  notes: string | null;
  overall_difficulty: number | null;
  satisfaction: number | null;
  soreness_level: number | null;
  submitted_at: string;
  user_id: string;
  workout_session_id: string;
};

const setLogSchema = {
  type: "object",
  required: [
    "id",
    "exerciseId",
    "exerciseName",
    "workoutTemplateExerciseId",
    "sequence",
    "setNumber",
    "performedReps",
    "performedWeight",
    "performedWeightUnit",
    "performedDurationSeconds",
    "performedDistanceMeters",
    "restSecondsActual",
    "rpe",
    "completed",
    "notes",
    "loggedAt",
  ],
  properties: {
    id: { type: "string" },
    exerciseId: { type: "string" },
    exerciseName: { type: "string" },
    workoutTemplateExerciseId: nullableStringSchema,
    sequence: { type: "integer" },
    setNumber: { type: "integer" },
    performedReps: nullableIntegerSchema,
    performedWeight: nullableNumberSchema,
    performedWeightUnit: nullableStringSchema,
    performedDurationSeconds: nullableIntegerSchema,
    performedDistanceMeters: nullableNumberSchema,
    restSecondsActual: nullableIntegerSchema,
    rpe: nullableIntegerSchema,
    completed: { type: "boolean" },
    notes: nullableStringSchema,
    loggedAt: dateTimeSchema,
  },
} as const;
const feedbackSchema = {
  type: "object",
  required: [
    "id",
    "workoutSessionId",
    "userId",
    "assignmentId",
    "overallDifficulty",
    "energyLevel",
    "sorenessLevel",
    "satisfaction",
    "notes",
    "submittedAt",
  ],
  properties: {
    id: { type: "string" },
    workoutSessionId: { type: "string" },
    userId: { type: "string" },
    assignmentId: nullableStringSchema,
    overallDifficulty: nullableIntegerSchema,
    energyLevel: nullableIntegerSchema,
    sorenessLevel: nullableIntegerSchema,
    satisfaction: nullableIntegerSchema,
    notes: nullableStringSchema,
    submittedAt: dateTimeSchema,
  },
} as const;
const sessionSchema = {
  type: "object",
  required: [
    "id",
    "user",
    "workoutTemplate",
    "workoutTemplateName",
    "assignmentId",
    "status",
    "startedAt",
    "completedAt",
    "durationSeconds",
    "performedVersionSnapshot",
    "notes",
    "createdAt",
    "updatedAt",
    "setLogs",
    "sets",
    "feedback",
  ],
  properties: {
    id: { type: "string" },
    user: {
      type: "object",
      required: ["id", "displayName"],
      properties: { id: { type: "string" }, displayName: { type: "string" } },
    },
    workoutTemplate: {
      type: "object",
      required: ["id", "name", "slug"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
      },
    },
    workoutTemplateName: { type: "string" },
    assignmentId: nullableStringSchema,
    status: { type: "string" },
    startedAt: dateTimeSchema,
    completedAt: { anyOf: [dateTimeSchema, { type: "null" }] },
    durationSeconds: nullableIntegerSchema,
    performedVersionSnapshot: { type: "object", additionalProperties: true },
    notes: nullableStringSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    setLogs: { type: "array", items: setLogSchema },
    sets: { type: "array", items: setLogSchema },
    feedback: { anyOf: [feedbackSchema, { type: "null" }] },
  },
} as const;
const reportingResponseSchema = {
  type: "object",
  required: ["items", "pagination", "summary"],
  properties: {
    items: { type: "array", items: sessionSchema },
    pagination: {
      type: "object",
      required: ["limit", "offset", "total"],
      properties: {
        limit: { type: "integer" },
        offset: { type: "integer" },
        total: { type: "integer" },
      },
    },
    summary: {
      type: "object",
      required: [
        "completedSessions",
        "plannedSessions",
        "inProgressSessions",
        "abandonedSessions",
        "feedbackCount",
      ],
      properties: {
        completedSessions: { type: "integer" },
        plannedSessions: { type: "integer" },
        inProgressSessions: { type: "integer" },
        abandonedSessions: { type: "integer" },
        feedbackCount: { type: "integer" },
      },
    },
  },
} as const;

function sessionBase() {
  return "SELECT workout_sessions.*, users.display_name AS user_display_name, workout_templates.name AS workout_name, workout_templates.slug AS workout_slug, workout_feedback.id AS feedback_id FROM workout_sessions INNER JOIN users ON users.id = workout_sessions.user_id INNER JOIN workout_templates ON workout_templates.id = workout_sessions.workout_template_id LEFT JOIN workout_feedback ON workout_feedback.workout_session_id = workout_sessions.id";
}
function mapSetLog(row: SetLogRow) {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    workoutTemplateExerciseId: row.workout_template_exercise_id,
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
function mapFeedback(row: FeedbackRow | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    overallDifficulty: row.overall_difficulty,
    energyLevel: row.energy_level,
    sorenessLevel: row.soreness_level,
    satisfaction: row.satisfaction,
    notes: row.notes,
    submittedAt: row.submitted_at,
  };
}
function getSessionDetail(request: FastifyRequest, sessionId: string) {
  const row = request.server.db
    .prepare(`${sessionBase()} WHERE workout_sessions.id = ?`)
    .get(sessionId) as SessionRow | undefined;
  if (!row) return null;
  const setLogs = request.server.db
    .prepare(
      "SELECT exercise_set_logs.*, exercises.name AS exercise_name FROM exercise_set_logs INNER JOIN exercises ON exercises.id = exercise_set_logs.exercise_id WHERE workout_session_id = ? ORDER BY sequence ASC, set_number ASC",
    )
    .all(sessionId) as SetLogRow[];
  const feedback = request.server.db
    .prepare("SELECT * FROM workout_feedback WHERE workout_session_id = ?")
    .get(sessionId) as FeedbackRow | undefined;
  const mappedSetLogs = setLogs.map(mapSetLog);
  return {
    id: row.id,
    user: { id: row.user_id, displayName: row.user_display_name },
    workoutTemplate: {
      id: row.workout_template_id,
      name: row.workout_name,
      slug: row.workout_slug,
    },
    workoutTemplateName: row.workout_name,
    assignmentId: row.assignment_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    performedVersionSnapshot: parseJson(row.performed_version_snapshot, {}),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    setLogs: mappedSetLogs,
    sets: mappedSetLogs,
    feedback: mapFeedback(feedback),
  };
}

async function listSessions(request: FastifyRequest) {
  const query = request.query as PaginationQuery;
  const { limit, offset } = getPagination(query);
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (query.userId) {
    conditions.push("workout_sessions.user_id = ?");
    params.push(query.userId);
  }
  if (query.status) {
    conditions.push("workout_sessions.status = ?");
    params.push(query.status);
  }
  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";
  const rows = request.server.db
    .prepare(
      `${sessionBase()}${whereClause} ORDER BY workout_sessions.started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SessionRow[];
  const count = request.server.db
    .prepare(`SELECT COUNT(*) AS count FROM workout_sessions${whereClause}`)
    .get(...params) as { count: number };
  const items = rows.map((row) => getSessionDetail(request, row.id));
  const summaryRow = request.server.db
    .prepare(
      `SELECT SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedSessions, SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS plannedSessions, SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgressSessions, SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandonedSessions FROM workout_sessions${whereClause}`,
    )
    .get(...params) as Record<string, number | null>;
  const feedbackCount = request.server.db
    .prepare("SELECT COUNT(*) AS count FROM workout_feedback")
    .get() as { count: number };
  return {
    items,
    pagination: { limit, offset, total: count.count },
    summary: {
      completedSessions: summaryRow.completedSessions ?? 0,
      plannedSessions: summaryRow.plannedSessions ?? 0,
      inProgressSessions: summaryRow.inProgressSessions ?? 0,
      abandonedSessions: summaryRow.abandonedSessions ?? 0,
      feedbackCount: feedbackCount.count,
    },
  };
}
async function getSession(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const session = getSessionDetail(request, params.id);
  return (
    session ??
    sendNotFound(reply, "SESSION_NOT_FOUND", "Workout session not found.")
  );
}
async function listFeedback(request: FastifyRequest) {
  const query = request.query as PaginationQuery & { assignmentId?: string };
  const rows = query.assignmentId
    ? (request.server.db
        .prepare(
          "SELECT * FROM workout_feedback WHERE assignment_id = ? ORDER BY submitted_at DESC",
        )
        .all(query.assignmentId) as FeedbackRow[])
    : (request.server.db
        .prepare("SELECT * FROM workout_feedback ORDER BY submitted_at DESC")
        .all() as FeedbackRow[]);
  return {
    items: rows.map((row) => mapFeedback(row)).filter(Boolean),
    pagination: { limit: rows.length, offset: 0, total: rows.length },
  };
}

export function adminReportingRoutes({
  apiBasePath,
}: AdminRouteOptions): AppRouteDefinition[] {
  const auth = requireAdminAuth();
  return [
    {
      method: "GET",
      operationId: "listWorkoutSessions",
      preHandler: auth,
      responseContentType: "application/json",
      response: { 200: reportingResponseSchema, 401: errorResponseSchema },
      summary: "List workout sessions with reporting summary.",
      tags: ["admin-reporting"],
      url: `${apiBasePath}/admin/reporting/sessions`,
      schema: buildRouteSchema({
        tags: ["admin-reporting"],
        summary: "List workout sessions with reporting summary.",
        querystring: paginationQuerySchema,
        response: { 200: reportingResponseSchema, 401: errorResponseSchema },
      }),
      handler: listSessions,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "getWorkoutSession",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: sessionSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get one workout session report.",
      tags: ["admin-reporting"],
      url: `${apiBasePath}/admin/reporting/sessions/:id`,
      schema: buildRouteSchema({
        tags: ["admin-reporting"],
        summary: "Get one workout session report.",
        params: idParamSchema,
        response: {
          200: sessionSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getSession,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "listWorkoutFeedback",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: buildListResponseSchema(feedbackSchema),
        401: errorResponseSchema,
      },
      summary: "List workout feedback entries.",
      tags: ["admin-reporting"],
      url: `${apiBasePath}/admin/reporting/feedback`,
      schema: buildRouteSchema({
        tags: ["admin-reporting"],
        summary: "List workout feedback entries.",
        response: {
          200: buildListResponseSchema(feedbackSchema),
          401: errorResponseSchema,
        },
      }),
      handler: listFeedback,
      security: [{ bearerAuth: [] }],
    },
  ];
}
