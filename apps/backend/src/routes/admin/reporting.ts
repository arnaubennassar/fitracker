import type { FastifyReply, FastifyRequest } from "fastify";

import {
  countWorkoutFeedbackBySessionFilters,
  countWorkoutSessions,
  getWorkoutSessionDetail,
  listWorkoutFeedback,
  listWorkoutSessionRows,
  summarizeWorkoutSessions,
} from "../../repos/workout-sessions.js";
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
  sendNotFound,
} from "./shared.js";

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
    "mood",
    "difficultyRating",
    "energyRating",
    "painFlag",
    "painNotes",
    "freeText",
    "submittedAt",
  ],
  properties: {
    id: { type: "string" },
    workoutSessionId: { type: "string" },
    mood: nullableStringSchema,
    difficultyRating: nullableIntegerSchema,
    energyRating: nullableIntegerSchema,
    painFlag: { type: "boolean" },
    painNotes: nullableStringSchema,
    freeText: nullableStringSchema,
    submittedAt: dateTimeSchema,
  },
} as const;

const sessionSchema = {
  type: "object",
  required: [
    "id",
    "workoutTemplate",
    "assignmentId",
    "status",
    "startedAt",
    "completedAt",
    "durationSeconds",
    "performedVersionSnapshot",
    "notes",
    "createdAt",
    "updatedAt",
    "sets",
    "feedback",
  ],
  properties: {
    id: { type: "string" },
    workoutTemplate: {
      type: "object",
      required: ["id", "name", "slug"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
      },
    },
    assignmentId: nullableStringSchema,
    status: { type: "string" },
    startedAt: dateTimeSchema,
    completedAt: { anyOf: [dateTimeSchema, { type: "null" }] },
    durationSeconds: nullableIntegerSchema,
    performedVersionSnapshot: { type: "object", additionalProperties: true },
    notes: nullableStringSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
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

function mapSetLog(
  setLog: NonNullable<
    ReturnType<typeof getWorkoutSessionDetail>
  >["setLogs"][number],
) {
  return {
    id: setLog.id,
    exerciseId: setLog.exercise.id,
    exerciseName: setLog.exercise.name,
    workoutTemplateExerciseId: setLog.workoutTemplateExerciseId,
    sequence: setLog.sequence,
    setNumber: setLog.setNumber,
    performedReps: setLog.performedReps,
    performedWeight: setLog.performedWeight,
    performedWeightUnit: setLog.performedWeightUnit,
    performedDurationSeconds: setLog.performedDurationSeconds,
    performedDistanceMeters: setLog.performedDistanceMeters,
    restSecondsActual: setLog.restSecondsActual,
    rpe: setLog.rpe,
    completed: setLog.completed,
    notes: setLog.notes,
    loggedAt: setLog.loggedAt,
  };
}

function mapFeedback(
  feedback: NonNullable<ReturnType<typeof getWorkoutSessionDetail>>["feedback"],
) {
  if (!feedback) {
    return null;
  }

  return {
    id: feedback.id,
    workoutSessionId: feedback.workoutSessionId,
    mood: feedback.mood,
    difficultyRating: feedback.difficultyRating,
    energyRating: feedback.energyRating,
    painFlag: feedback.painFlag,
    painNotes: feedback.painNotes,
    freeText: feedback.freeText,
    submittedAt: feedback.submittedAt,
  };
}

function mapSession(
  session: NonNullable<ReturnType<typeof getWorkoutSessionDetail>>,
) {
  return {
    id: session.id,
    workoutTemplate: session.workoutTemplate,
    assignmentId: session.assignmentId,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    durationSeconds: session.durationSeconds,
    performedVersionSnapshot: session.performedVersionSnapshot,
    notes: session.notes,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    sets: session.setLogs.map(mapSetLog),
    feedback: mapFeedback(session.feedback),
  };
}

async function listSessions(request: FastifyRequest) {
  const query = request.query as PaginationQuery;
  const { limit, offset } = getPagination(query);
  const filters = {
    ...(query.status ? { status: query.status } : {}),
  };
  const sessionDetails = listWorkoutSessionRows(request.server.db, filters, {
    limit,
    offset,
  })
    .map((session) =>
      getWorkoutSessionDetail(request.server.db, {
        sessionId: session.id,
      }),
    )
    .filter(
      (
        session,
      ): session is NonNullable<ReturnType<typeof getWorkoutSessionDetail>> =>
        session !== null,
    );
  const items = sessionDetails.map(mapSession);

  return {
    items,
    pagination: {
      limit,
      offset,
      total: countWorkoutSessions(request.server.db, filters),
    },
    summary: {
      ...summarizeWorkoutSessions(request.server.db, filters),
      feedbackCount: countWorkoutFeedbackBySessionFilters(
        request.server.db,
        filters,
      ),
    },
  };
}

async function getSession(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const session = getWorkoutSessionDetail(request.server.db, {
    sessionId: params.id,
  });

  return (
    (session ? mapSession(session) : null) ??
    sendNotFound(reply, "SESSION_NOT_FOUND", "Workout session not found.")
  );
}

async function listFeedbackEntries(request: FastifyRequest) {
  const query = request.query as PaginationQuery;
  const { limit, offset } = getPagination(query);
  const result = listWorkoutFeedback(request.server.db, { limit, offset });

  return {
    items: result.items.map((item) => mapFeedback(item)),
    pagination: {
      limit,
      offset,
      total: result.total,
    },
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
        querystring: paginationQuerySchema,
        response: {
          200: buildListResponseSchema(feedbackSchema),
          401: errorResponseSchema,
        },
      }),
      handler: listFeedbackEntries,
      security: [{ bearerAuth: [] }],
    },
  ];
}
