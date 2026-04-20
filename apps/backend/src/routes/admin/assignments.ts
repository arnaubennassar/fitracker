import type { FastifyReply, FastifyRequest } from "fastify";

import { requireAdminAuth } from "../auth.js";
import type { AppRouteDefinition } from "../registry.js";
import { buildRouteSchema } from "../registry.js";
import type { AdminRouteOptions, PaginationQuery } from "./shared.js";
import {
  buildListResponseSchema,
  createId,
  dateSchema,
  dateTimeSchema,
  errorResponseSchema,
  getPagination,
  handleSqliteError,
  idParamSchema,
  nowIsoString,
  nullableDateSchema,
  nullableDateTimeSchema,
  nullableIntegerSchema,
  nullableStringSchema,
  paginationQuerySchema,
  sendBadRequest,
  sendNotFound,
  toBoolean,
  toSqliteBoolean,
} from "./shared.js";

type AssignmentRow = {
  assigned_by: string;
  completed_sessions: number;
  created_at: string;
  ends_on: string | null;
  frequency_per_week: number | null;
  id: string;
  is_active: number;
  last_completed_at: string | null;
  schedule_notes: string | null;
  starts_on: string;
  updated_at: string;
  workout_template_id: string;
  workout_template_name: string;
  workout_template_slug: string;
};

const assignmentSchema = {
  type: "object",
  required: [
    "id",
    "workoutTemplate",
    "assignedBy",
    "startsOn",
    "endsOn",
    "scheduleNotes",
    "frequencyPerWeek",
    "isActive",
    "createdAt",
    "updatedAt",
    "completedSessions",
    "lastCompletedAt",
  ],
  properties: {
    id: {
      type: "string",
    },
    workoutTemplate: {
      type: "object",
      required: ["id", "name", "slug"],
      properties: {
        id: {
          type: "string",
        },
        name: {
          type: "string",
        },
        slug: {
          type: "string",
        },
      },
    },
    assignedBy: {
      type: "string",
    },
    startsOn: dateSchema,
    endsOn: nullableDateSchema,
    scheduleNotes: nullableStringSchema,
    frequencyPerWeek: nullableIntegerSchema,
    isActive: {
      type: "boolean",
    },
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    completedSessions: {
      type: "integer",
    },
    lastCompletedAt: nullableDateTimeSchema,
  },
} as const;

const assignmentBodySchema = {
  type: "object",
  required: ["workoutTemplateId", "assignedBy", "startsOn"],
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
    },
    workoutTemplateId: {
      type: "string",
      minLength: 1,
    },
    assignedBy: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    startsOn: dateSchema,
    endsOn: nullableDateSchema,
    scheduleNotes: {
      anyOf: [
        {
          type: "string",
          maxLength: 2000,
        },
        {
          type: "null",
        },
      ],
    },
    frequencyPerWeek: {
      anyOf: [
        {
          type: "integer",
          minimum: 1,
          maximum: 14,
        },
        {
          type: "null",
        },
      ],
    },
    isActive: {
      type: "boolean",
    },
  },
} as const;

function mapAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    workoutTemplate: {
      id: row.workout_template_id,
      name: row.workout_template_name,
      slug: row.workout_template_slug,
    },
    assignedBy: row.assigned_by,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    scheduleNotes: row.schedule_notes,
    frequencyPerWeek: row.frequency_per_week,
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedSessions: row.completed_sessions,
    lastCompletedAt: row.last_completed_at,
  };
}

function assignmentBaseQuery(whereClause: string) {
  return `
    SELECT
      workout_assignments.id,
      workout_assignments.workout_template_id,
      workout_templates.name AS workout_template_name,
      workout_templates.slug AS workout_template_slug,
      workout_assignments.assigned_by,
      workout_assignments.starts_on,
      workout_assignments.ends_on,
      workout_assignments.schedule_notes,
      workout_assignments.frequency_per_week,
      workout_assignments.is_active,
      workout_assignments.created_at,
      workout_assignments.updated_at,
      COUNT(
        CASE
          WHEN workout_sessions.status = 'completed' THEN workout_sessions.id
        END
      ) AS completed_sessions,
      MAX(
        CASE
          WHEN workout_sessions.status = 'completed' THEN workout_sessions.completed_at
        END
      ) AS last_completed_at
    FROM workout_assignments
    INNER JOIN workout_templates
      ON workout_templates.id = workout_assignments.workout_template_id
    LEFT JOIN workout_sessions
      ON workout_sessions.assignment_id = workout_assignments.id
    ${whereClause}
    GROUP BY
      workout_assignments.id,
      workout_assignments.workout_template_id,
      workout_templates.name,
      workout_templates.slug,
      workout_assignments.assigned_by,
      workout_assignments.starts_on,
      workout_assignments.ends_on,
      workout_assignments.schedule_notes,
      workout_assignments.frequency_per_week,
      workout_assignments.is_active,
      workout_assignments.created_at,
      workout_assignments.updated_at
  `;
}

function getAssignmentDetail(request: FastifyRequest, assignmentId: string) {
  const row = request.server.db
    .prepare(
      `
        ${assignmentBaseQuery("WHERE workout_assignments.id = ?")}
      `,
    )
    .get(assignmentId) as AssignmentRow | undefined;

  if (!row) {
    return null;
  }

  return mapAssignment(row);
}

function validateAssignmentWindow(
  reply: FastifyReply,
  startsOn: string,
  endsOn: string | null,
) {
  if (endsOn && endsOn < startsOn) {
    return sendBadRequest(
      reply,
      "ASSIGNMENT_DATE_RANGE_INVALID",
      "Assignment end date must be on or after the start date.",
    );
  }

  return null;
}

async function listAssignments(request: FastifyRequest) {
  const query = request.query as PaginationQuery;
  const { limit, offset, search } = getPagination(query);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    conditions.push(
      "(workout_templates.name LIKE ? COLLATE NOCASE OR workout_assignments.assigned_by LIKE ? COLLATE NOCASE)",
    );
    params.push(`%${search}%`, `%${search}%`);
  }

  if (query.isActive !== undefined) {
    conditions.push("workout_assignments.is_active = ?");
    params.push(toSqliteBoolean(query.isActive) ?? 0);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const items = request.server.db
    .prepare(
      `
        ${assignmentBaseQuery(whereClause)}
        ORDER BY workout_assignments.starts_on DESC, workout_assignments.created_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...params, limit, offset) as AssignmentRow[];
  const totalRow = request.server.db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM workout_assignments
        INNER JOIN workout_templates
          ON workout_templates.id = workout_assignments.workout_template_id
        ${whereClause}
      `,
    )
    .get(...params) as { count: number };

  return {
    items: items.map(mapAssignment),
    pagination: {
      limit,
      offset,
      total: totalRow.count,
    },
  };
}

async function getAssignment(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const assignment = getAssignmentDetail(request, params.id);

  return (
    assignment ??
    sendNotFound(reply, "ASSIGNMENT_NOT_FOUND", "Assignment not found.")
  );
}

async function createAssignment(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    assignedBy: string;
    endsOn?: string | null;
    frequencyPerWeek?: number | null;
    id?: string;
    isActive?: boolean;
    scheduleNotes?: string | null;
    startsOn: string;
    workoutTemplateId: string;
  };

  const dateError = validateAssignmentWindow(
    reply,
    body.startsOn,
    body.endsOn ?? null,
  );

  if (dateError) {
    return dateError;
  }

  const id = body.id ?? createId("assignment");
  const now = nowIsoString();

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO workout_assignments (
            id,
            workout_template_id,
            assigned_by,
            starts_on,
            ends_on,
            schedule_notes,
            frequency_per_week,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        body.workoutTemplateId,
        body.assignedBy.trim(),
        body.startsOn,
        body.endsOn ?? null,
        body.scheduleNotes ?? null,
        body.frequencyPerWeek ?? null,
        toSqliteBoolean(body.isActive ?? true) ?? 1,
        now,
        now,
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "ASSIGNMENT_CONFLICT",
      conflictMessage: "Assignment could not be created.",
    });
  }

  return reply.code(201).send(getAssignmentDetail(request, id));
}

async function updateAssignment(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const body = request.body as {
    assignedBy?: string;
    endsOn?: string | null;
    frequencyPerWeek?: number | null;
    isActive?: boolean;
    scheduleNotes?: string | null;
    startsOn?: string;
    workoutTemplateId?: string;
  };
  const current = getAssignmentDetail(request, params.id);

  if (!current) {
    return sendNotFound(reply, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
  }

  const next = {
    assignedBy: body.assignedBy ?? current.assignedBy,
    endsOn: body.endsOn ?? current.endsOn,
    frequencyPerWeek: body.frequencyPerWeek ?? current.frequencyPerWeek,
    isActive: body.isActive ?? current.isActive,
    scheduleNotes: body.scheduleNotes ?? current.scheduleNotes,
    startsOn: body.startsOn ?? current.startsOn,
    workoutTemplateId: body.workoutTemplateId ?? current.workoutTemplate.id,
  };
  const dateError = validateAssignmentWindow(reply, next.startsOn, next.endsOn);

  if (dateError) {
    return dateError;
  }

  try {
    request.server.db
      .prepare(
        `
          UPDATE workout_assignments
          SET workout_template_id = ?,
              assigned_by = ?,
              starts_on = ?,
              ends_on = ?,
              schedule_notes = ?,
              frequency_per_week = ?,
              is_active = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        next.workoutTemplateId,
        next.assignedBy.trim(),
        next.startsOn,
        next.endsOn,
        next.scheduleNotes,
        next.frequencyPerWeek,
        toSqliteBoolean(next.isActive) ?? 0,
        nowIsoString(),
        params.id,
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "ASSIGNMENT_CONFLICT",
      conflictMessage: "Assignment could not be updated.",
    });
  }

  return getAssignmentDetail(request, params.id);
}

async function deleteAssignment(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const result = request.server.db
    .prepare("DELETE FROM workout_assignments WHERE id = ?")
    .run(params.id);

  if (result.changes === 0) {
    return sendNotFound(reply, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
  }

  return reply.code(204).send();
}

export function adminAssignmentRoutes({
  apiBasePath,
}: AdminRouteOptions): AppRouteDefinition[] {
  const auth = requireAdminAuth();

  return [
    {
      method: "GET",
      operationId: "listAssignments",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: buildListResponseSchema(assignmentSchema),
        401: errorResponseSchema,
      },
      summary: "List workout assignments.",
      tags: ["admin-assignments"],
      url: `${apiBasePath}/admin/assignments`,
      schema: buildRouteSchema({
        tags: ["admin-assignments"],
        summary: "List workout assignments.",
        querystring: paginationQuerySchema,
        response: {
          200: buildListResponseSchema(assignmentSchema),
          401: errorResponseSchema,
        },
      }),
      handler: listAssignments,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "getAssignment",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: assignmentSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get one workout assignment.",
      tags: ["admin-assignments"],
      url: `${apiBasePath}/admin/assignments/:id`,
      schema: buildRouteSchema({
        tags: ["admin-assignments"],
        summary: "Get one workout assignment.",
        params: idParamSchema,
        response: {
          200: assignmentSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getAssignment,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createAssignment",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: assignmentSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create a workout assignment.",
      tags: ["admin-assignments"],
      url: `${apiBasePath}/admin/assignments`,
      schema: buildRouteSchema({
        body: assignmentBodySchema,
        tags: ["admin-assignments"],
        summary: "Create a workout assignment.",
        response: {
          201: assignmentSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createAssignment,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateAssignment",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: assignmentSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Update a workout assignment.",
      tags: ["admin-assignments"],
      url: `${apiBasePath}/admin/assignments/:id`,
      schema: buildRouteSchema({
        body: {
          ...assignmentBodySchema,
          required: [],
        },
        tags: ["admin-assignments"],
        summary: "Update a workout assignment.",
        params: idParamSchema,
        response: {
          200: assignmentSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: updateAssignment,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteAssignment",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        204: { type: "null" },
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Delete a workout assignment.",
      tags: ["admin-assignments"],
      url: `${apiBasePath}/admin/assignments/:id`,
      schema: buildRouteSchema({
        tags: ["admin-assignments"],
        summary: "Delete a workout assignment.",
        params: idParamSchema,
        response: {
          204: { type: "null" },
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: deleteAssignment,
      security: [{ bearerAuth: [] }],
    },
  ];
}
