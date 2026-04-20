import type { FastifyReply, FastifyRequest } from "fastify";

import { requireUserSession } from "../lib/user-session.js";
import {
  countWorkoutSessions,
  getWorkoutSessionDetail,
  listWorkoutSessionRows,
  mapWorkoutSessionSetLogRow,
} from "../repos/workout-sessions.js";
import {
  getWorkoutTemplateDetail,
  getWorkoutTemplateSummary,
} from "../repos/workout-templates.js";
import {
  createId,
  dateSchema,
  dateTimeSchema,
  errorResponseSchema,
  nowIsoString,
  nullableIntegerSchema,
  nullableNumberSchema,
  nullableStringSchema,
  parseJson,
  sendBadRequest,
  sendNotFound,
  stringArraySchema,
  toBoolean,
  toSqliteBoolean,
} from "./admin/shared.js";
import type { AppRouteDefinition } from "./registry.js";
import { buildRouteSchema } from "./registry.js";
import type { UserRouteOptions } from "./user.js";

type AssignmentListRow = {
  assigned_by: string;
  created_at: string;
  ends_on: string | null;
  frequency_per_week: number | null;
  id: string;
  is_active: number;
  schedule_notes: string | null;
  starts_on: string;
  template_description: string | null;
  template_difficulty: string | null;
  template_duration: number | null;
  template_goal: string | null;
  template_id: string;
  template_name: string;
  template_slug: string;
};

type ExerciseRow = {
  category_id: string;
  category_name: string;
  description: string | null;
  difficulty: string;
  equipment: string;
  id: string;
  instructions: string;
  is_active: number;
  name: string;
  primary_muscles: string;
  secondary_muscles: string;
  slug: string;
  tracking_mode: string;
};

type MediaRow = {
  duration_seconds: number | null;
  id: string;
  mime_type: string | null;
  sort_order: number;
  thumbnail_url: string | null;
  type: string;
  url: string;
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
  workout_session_id: string;
  workout_template_exercise_id: string | null;
};

const exerciseSummarySchema = {
  type: "object",
  required: ["id", "slug", "name", "description", "trackingMode", "difficulty"],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
    trackingMode: { type: "string" },
    difficulty: { type: "string" },
  },
} as const;

const templateExerciseSchema = {
  type: "object",
  required: [
    "id",
    "sequence",
    "blockLabel",
    "instructionOverride",
    "targetSets",
    "targetReps",
    "targetRepsMin",
    "targetRepsMax",
    "targetWeight",
    "targetWeightUnit",
    "targetDurationSeconds",
    "targetDistanceMeters",
    "restSeconds",
    "tempo",
    "rpeTarget",
    "rirTarget",
    "isOptional",
    "exercise",
  ],
  properties: {
    id: { type: "string" },
    sequence: { type: "integer" },
    blockLabel: { type: "string" },
    instructionOverride: nullableStringSchema,
    targetSets: nullableIntegerSchema,
    targetReps: nullableIntegerSchema,
    targetRepsMin: nullableIntegerSchema,
    targetRepsMax: nullableIntegerSchema,
    targetWeight: nullableNumberSchema,
    targetWeightUnit: nullableStringSchema,
    targetDurationSeconds: nullableIntegerSchema,
    targetDistanceMeters: nullableNumberSchema,
    restSeconds: nullableIntegerSchema,
    tempo: nullableStringSchema,
    rpeTarget: nullableIntegerSchema,
    rirTarget: nullableIntegerSchema,
    isOptional: { type: "boolean" },
    exercise: exerciseSummarySchema,
  },
} as const;

const workoutTemplateSchema = {
  type: "object",
  required: [
    "id",
    "slug",
    "name",
    "description",
    "goal",
    "estimatedDurationMin",
    "difficulty",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
    goal: nullableStringSchema,
    estimatedDurationMin: nullableIntegerSchema,
    difficulty: nullableStringSchema,
  },
} as const;

const workoutTemplateDetailSchema = {
  type: "object",
  required: [...workoutTemplateSchema.required, "exercises"],
  properties: {
    ...workoutTemplateSchema.properties,
    exercises: { type: "array", items: templateExerciseSchema },
  },
} as const;

const assignmentSchema = {
  type: "object",
  required: [
    "id",
    "assignedBy",
    "startsOn",
    "endsOn",
    "scheduleNotes",
    "frequencyPerWeek",
    "isActive",
    "createdAt",
    "workoutTemplate",
  ],
  properties: {
    id: { type: "string" },
    assignedBy: { type: "string" },
    startsOn: dateSchema,
    endsOn: { anyOf: [dateSchema, { type: "null" }] },
    scheduleNotes: nullableStringSchema,
    frequencyPerWeek: nullableIntegerSchema,
    isActive: { type: "boolean" },
    createdAt: dateTimeSchema,
    workoutTemplate: workoutTemplateSchema,
  },
} as const;

const exerciseDetailSchema = {
  type: "object",
  required: [
    "id",
    "slug",
    "name",
    "category",
    "description",
    "instructions",
    "equipment",
    "trackingMode",
    "difficulty",
    "primaryMuscles",
    "secondaryMuscles",
    "isActive",
    "media",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    category: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
    description: nullableStringSchema,
    instructions: { type: "string" },
    equipment: stringArraySchema,
    trackingMode: { type: "string" },
    difficulty: { type: "string" },
    primaryMuscles: stringArraySchema,
    secondaryMuscles: stringArraySchema,
    isActive: { type: "boolean" },
    media: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "type",
          "url",
          "mimeType",
          "durationSeconds",
          "thumbnailUrl",
          "sortOrder",
        ],
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          url: { type: "string" },
          mimeType: nullableStringSchema,
          durationSeconds: nullableIntegerSchema,
          thumbnailUrl: nullableStringSchema,
          sortOrder: { type: "integer" },
        },
      },
    },
  },
} as const;

const setLogSchema = {
  type: "object",
  required: [
    "id",
    "workoutSessionId",
    "workoutTemplateExerciseId",
    "exercise",
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
    workoutSessionId: { type: "string" },
    workoutTemplateExerciseId: nullableStringSchema,
    exercise: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
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
    "status",
    "startedAt",
    "completedAt",
    "durationSeconds",
    "notes",
    "assignmentId",
    "workoutTemplate",
    "sets",
    "feedback",
  ],
  properties: {
    id: { type: "string" },
    status: { type: "string" },
    startedAt: dateTimeSchema,
    completedAt: { anyOf: [dateTimeSchema, { type: "null" }] },
    durationSeconds: nullableIntegerSchema,
    notes: nullableStringSchema,
    assignmentId: nullableStringSchema,
    workoutTemplate: {
      type: "object",
      required: ["id", "name", "slug"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
      },
    },
    sets: { type: "array", items: setLogSchema },
    feedback: { anyOf: [feedbackSchema, { type: "null" }] },
  },
} as const;

const sessionListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 50 },
    offset: { type: "integer", minimum: 0 },
    status: {
      type: "string",
      enum: ["planned", "in_progress", "completed", "abandoned"],
    },
  },
} as const;

const createSessionBodySchema = {
  type: "object",
  required: ["workoutTemplateId"],
  additionalProperties: false,
  properties: {
    assignmentId: nullableStringSchema,
    notes: nullableStringSchema,
    workoutTemplateId: { type: "string", minLength: 1 },
  },
} as const;

const updateSessionBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    notes: nullableStringSchema,
    status: {
      type: "string",
      enum: ["planned", "in_progress", "completed", "abandoned"],
    },
    startedAt: dateTimeSchema,
    completedAt: { anyOf: [dateTimeSchema, { type: "null" }] },
    durationSeconds: nullableIntegerSchema,
  },
} as const;

const createSetBodySchema = {
  type: "object",
  required: ["exerciseId", "sequence", "setNumber"],
  additionalProperties: false,
  properties: {
    exerciseId: { type: "string", minLength: 1 },
    workoutTemplateExerciseId: nullableStringSchema,
    sequence: { type: "integer", minimum: 1 },
    setNumber: { type: "integer", minimum: 1 },
    performedReps: nullableIntegerSchema,
    performedWeight: nullableNumberSchema,
    performedWeightUnit: nullableStringSchema,
    performedDurationSeconds: nullableIntegerSchema,
    performedDistanceMeters: nullableNumberSchema,
    restSecondsActual: nullableIntegerSchema,
    rpe: nullableIntegerSchema,
    completed: { type: "boolean" },
    notes: nullableStringSchema,
  },
} as const;

const updateSetBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    performedReps: nullableIntegerSchema,
    performedWeight: nullableNumberSchema,
    performedWeightUnit: nullableStringSchema,
    performedDurationSeconds: nullableIntegerSchema,
    performedDistanceMeters: nullableNumberSchema,
    restSecondsActual: nullableIntegerSchema,
    rpe: nullableIntegerSchema,
    completed: { type: "boolean" },
    notes: nullableStringSchema,
  },
} as const;

const completeSessionBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    completedAt: dateTimeSchema,
    durationSeconds: nullableIntegerSchema,
    notes: nullableStringSchema,
  },
} as const;

const feedbackBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mood: nullableStringSchema,
    difficultyRating: {
      anyOf: [{ type: "integer", minimum: 1, maximum: 10 }, { type: "null" }],
    },
    energyRating: {
      anyOf: [{ type: "integer", minimum: 1, maximum: 5 }, { type: "null" }],
    },
    painFlag: { type: "boolean" },
    painNotes: nullableStringSchema,
    freeText: nullableStringSchema,
  },
} as const;

const todayQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: dateSchema,
  },
} as const;

const workoutIdParamsSchema = {
  type: "object",
  required: ["workoutId"],
  additionalProperties: false,
  properties: { workoutId: { type: "string", minLength: 1 } },
} as const;

const exerciseIdParamsSchema = {
  type: "object",
  required: ["exerciseId"],
  additionalProperties: false,
  properties: { exerciseId: { type: "string", minLength: 1 } },
} as const;

const sessionIdParamsSchema = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const sessionSetParamsSchema = {
  type: "object",
  required: ["sessionId", "setId"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1 },
    setId: { type: "string", minLength: 1 },
  },
} as const;

function getUserId(request: FastifyRequest) {
  return request.userSession?.user.id ?? null;
}

function mapWorkoutTemplate(
  row: NonNullable<ReturnType<typeof getWorkoutTemplateSummary>>,
) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    goal: row.goal,
    estimatedDurationMin: row.estimatedDurationMin,
    difficulty: row.difficulty,
  };
}

function getWorkoutTemplate(request: FastifyRequest, workoutId: string) {
  return getWorkoutTemplateSummary(request.server.db, workoutId);
}

function mapAssignmentRow(row: AssignmentListRow) {
  return {
    id: row.id,
    assignedBy: row.assigned_by,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    scheduleNotes: row.schedule_notes,
    frequencyPerWeek: row.frequency_per_week,
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    workoutTemplate: {
      id: row.template_id,
      slug: row.template_slug,
      name: row.template_name,
      description: row.template_description,
      goal: row.template_goal,
      estimatedDurationMin: row.template_duration,
      difficulty: row.template_difficulty,
    },
  };
}

function listAssignmentsForUser(
  request: FastifyRequest,
  userId: string,
  options: { activeOnly?: boolean } = {},
) {
  const conditions = ["workout_assignments.user_id = ?"];
  const params: Array<string | number> = [userId];

  if (options.activeOnly) {
    conditions.push("workout_assignments.is_active = 1");
  }

  const rows = request.server.db
    .prepare(
      `
        SELECT
          workout_assignments.id,
          workout_assignments.assigned_by,
          workout_assignments.starts_on,
          workout_assignments.ends_on,
          workout_assignments.schedule_notes,
          workout_assignments.frequency_per_week,
          workout_assignments.is_active,
          workout_assignments.created_at,
          workout_templates.id AS template_id,
          workout_templates.slug AS template_slug,
          workout_templates.name AS template_name,
          workout_templates.description AS template_description,
          workout_templates.goal AS template_goal,
          workout_templates.estimated_duration_min AS template_duration,
          workout_templates.difficulty AS template_difficulty
        FROM workout_assignments
        INNER JOIN workout_templates
          ON workout_templates.id = workout_assignments.workout_template_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY workout_assignments.starts_on DESC, workout_assignments.created_at DESC
      `,
    )
    .all(...params) as AssignmentListRow[];

  return rows.map(mapAssignmentRow);
}

function mapExerciseRow(row: ExerciseRow, media: MediaRow[] = []) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: {
      id: row.category_id,
      name: row.category_name,
    },
    description: row.description,
    instructions: row.instructions,
    equipment: parseJson<string[]>(row.equipment, []),
    trackingMode: row.tracking_mode,
    difficulty: row.difficulty,
    primaryMuscles: parseJson<string[]>(row.primary_muscles, []),
    secondaryMuscles: parseJson<string[]>(row.secondary_muscles, []),
    isActive: toBoolean(row.is_active),
    media: media.map((mediaRow) => ({
      id: mediaRow.id,
      type: mediaRow.type,
      url: mediaRow.url,
      mimeType: mediaRow.mime_type,
      durationSeconds: mediaRow.duration_seconds,
      thumbnailUrl: mediaRow.thumbnail_url,
      sortOrder: mediaRow.sort_order,
    })),
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

function getSessionDetailForUser(
  request: FastifyRequest,
  sessionId: string,
  userId: string,
) {
  const session = getWorkoutSessionDetail(request.server.db, {
    sessionId,
    userId,
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    durationSeconds: session.durationSeconds,
    notes: session.notes,
    assignmentId: session.assignmentId,
    workoutTemplate: session.workoutTemplate,
    sets: session.setLogs,
    feedback: mapFeedback(session.feedback),
  };
}

function ensureSessionExists(
  request: FastifyRequest,
  sessionId: string,
  userId: string,
) {
  return request.server.db
    .prepare(
      "SELECT id, status FROM workout_sessions WHERE id = ? AND user_id = ? LIMIT 1",
    )
    .get(sessionId, userId) as { id: string; status: string } | undefined;
}

async function listMyWorkouts(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const items = listAssignmentsForUser(request, userId);
  return { items };
}

async function getTodayWorkouts(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const query = request.query as { date?: string };
  const today = (query.date ?? new Date().toISOString().slice(0, 10)) as string;
  const items = listAssignmentsForUser(request, userId, {
    activeOnly: true,
  }).filter((assignment) => {
    const starts = assignment.startsOn;
    const ends = assignment.endsOn;
    if (starts > today) return false;
    if (ends && ends < today) return false;
    return true;
  });

  return { date: today, items };
}

async function getMyWorkoutDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { workoutId: string };
  const template = getWorkoutTemplate(request, params.workoutId);

  if (!template || !template.isActive) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_FOUND",
      "Workout template not found.",
    );
  }

  const accessRow = request.server.db
    .prepare(
      `
        SELECT 1 FROM workout_assignments
        WHERE user_id = ? AND workout_template_id = ?
        LIMIT 1
      `,
    )
    .get(userId, params.workoutId) as unknown;

  if (!accessRow) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_ASSIGNED",
      "Workout template is not assigned to the current user.",
    );
  }

  const templateDetail = getWorkoutTemplateDetail(
    request.server.db,
    template.id,
  );

  if (!templateDetail) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_FOUND",
      "Workout template not found.",
    );
  }

  return {
    ...mapWorkoutTemplate(templateDetail),
    exercises: templateDetail.exercises,
  };
}

async function listMyExercises(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;

  const rows = request.server.db
    .prepare(
      `
        SELECT DISTINCT
          exercises.id,
          exercises.slug,
          exercises.name,
          exercises.description,
          exercises.instructions,
          exercises.equipment,
          exercises.tracking_mode,
          exercises.difficulty,
          exercises.primary_muscles,
          exercises.secondary_muscles,
          exercises.is_active,
          exercise_categories.id AS category_id,
          exercise_categories.name AS category_name
        FROM exercises
        INNER JOIN exercise_categories
          ON exercise_categories.id = exercises.category_id
        INNER JOIN workout_template_exercises
          ON workout_template_exercises.exercise_id = exercises.id
        INNER JOIN workout_assignments
          ON workout_assignments.workout_template_id = workout_template_exercises.workout_template_id
        WHERE workout_assignments.user_id = ?
          AND exercises.is_active = 1
        ORDER BY exercises.name ASC
      `,
    )
    .all(userId) as ExerciseRow[];

  return { items: rows.map((row) => mapExerciseRow(row)) };
}

async function getMyExerciseDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { exerciseId: string };

  const row = request.server.db
    .prepare(
      `
        SELECT DISTINCT
          exercises.*,
          exercise_categories.id AS category_id,
          exercise_categories.name AS category_name
        FROM exercises
        INNER JOIN exercise_categories
          ON exercise_categories.id = exercises.category_id
        INNER JOIN workout_template_exercises
          ON workout_template_exercises.exercise_id = exercises.id
        INNER JOIN workout_assignments
          ON workout_assignments.workout_template_id = workout_template_exercises.workout_template_id
        WHERE exercises.id = ?
          AND workout_assignments.user_id = ?
          AND exercises.is_active = 1
        LIMIT 1
      `,
    )
    .get(params.exerciseId, userId) as ExerciseRow | undefined;

  if (!row) {
    return sendNotFound(reply, "EXERCISE_NOT_FOUND", "Exercise not found.");
  }

  const media = request.server.db
    .prepare(
      "SELECT * FROM exercise_media WHERE exercise_id = ? ORDER BY sort_order ASC, id ASC",
    )
    .all(params.exerciseId) as MediaRow[];

  return mapExerciseRow(row, media);
}

async function createMyWorkoutSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const body = request.body as {
    assignmentId?: string | null;
    notes?: string | null;
    workoutTemplateId: string;
  };

  const template = getWorkoutTemplate(request, body.workoutTemplateId);
  if (!template) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_FOUND",
      "Workout template not found.",
    );
  }

  const assignmentForTemplate = request.server.db
    .prepare(
      `
        SELECT id
        FROM workout_assignments
        WHERE user_id = ?
          AND workout_template_id = ?
          AND is_active = 1
        LIMIT 1
      `,
    )
    .get(userId, body.workoutTemplateId) as { id: string } | undefined;

  if (!assignmentForTemplate) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_ASSIGNED",
      "Workout template is not assigned to the current user.",
    );
  }

  if (body.assignmentId) {
    const assignment = request.server.db
      .prepare(
        "SELECT id, user_id FROM workout_assignments WHERE id = ? LIMIT 1",
      )
      .get(body.assignmentId) as { id: string; user_id: string } | undefined;

    if (!assignment || assignment.user_id !== userId) {
      return sendBadRequest(
        reply,
        "WORKOUT_SESSION_ASSIGNMENT_INVALID",
        "The supplied assignment does not belong to this user.",
      );
    }
  }

  const id = createId("session");
  const now = nowIsoString();
  const templateDetail = getWorkoutTemplateDetail(
    request.server.db,
    body.workoutTemplateId,
  );

  if (!templateDetail) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_FOUND",
      "Workout template not found.",
    );
  }

  const snapshot = {
    template: mapWorkoutTemplate(templateDetail),
    exercises: templateDetail.exercises,
  };

  request.server.db
    .prepare(
      `
        INSERT INTO workout_sessions (
          id,
          user_id,
          workout_template_id,
          assignment_id,
          status,
          started_at,
          completed_at,
          duration_seconds,
          performed_version_snapshot,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 'in_progress', ?, NULL, NULL, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      userId,
      templateDetail.id,
      body.assignmentId ?? null,
      now,
      JSON.stringify(snapshot),
      body.notes ?? null,
      now,
      now,
    );

  return reply.code(201).send(getSessionDetailForUser(request, id, userId));
}

async function getMyWorkoutSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string };

  const detail = getSessionDetailForUser(request, params.sessionId, userId);

  if (!detail) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  return detail;
}

async function listMyWorkoutSessions(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;

  const query =
    (request.query as
      | {
          limit?: number;
          offset?: number;
          status?: string;
        }
      | undefined) ?? {};
  const filters = {
    userId,
    ...(query.status ? { status: query.status } : {}),
  };

  const limit = Math.min(query.limit ?? 20, 50);
  const offset = query.offset ?? 0;
  const items = listWorkoutSessionRows(request.server.db, filters, {
    limit,
    offset,
  })
    .map((session) => getSessionDetailForUser(request, session.id, userId))
    .filter(Boolean);
  const total = countWorkoutSessions(request.server.db, filters);

  return {
    items,
    limit,
    offset,
    total,
  };
}

async function updateMyWorkoutSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string };
  const body = request.body as {
    completedAt?: string | null;
    durationSeconds?: number | null;
    notes?: string | null;
    startedAt?: string;
    status?: string;
  };

  const existing = ensureSessionExists(request, params.sessionId, userId);
  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  const assignments: string[] = ["updated_at = ?"];
  const values: Array<string | number | null> = [nowIsoString()];

  if (body.status !== undefined) {
    assignments.push("status = ?");
    values.push(body.status);
  }
  if (body.startedAt !== undefined) {
    assignments.push("started_at = ?");
    values.push(body.startedAt);
  }
  if (body.completedAt !== undefined) {
    assignments.push("completed_at = ?");
    values.push(body.completedAt);
  }
  if (body.durationSeconds !== undefined) {
    assignments.push("duration_seconds = ?");
    values.push(body.durationSeconds);
  }
  if (body.notes !== undefined) {
    assignments.push("notes = ?");
    values.push(body.notes);
  }

  request.server.db
    .prepare(
      `
        UPDATE workout_sessions
        SET ${assignments.join(", ")}
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(...values, params.sessionId, userId);

  return getSessionDetailForUser(request, params.sessionId, userId);
}

async function createSetLog(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string };
  const existing = ensureSessionExists(request, params.sessionId, userId);
  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  const body = request.body as {
    completed?: boolean;
    exerciseId: string;
    notes?: string | null;
    performedDistanceMeters?: number | null;
    performedDurationSeconds?: number | null;
    performedReps?: number | null;
    performedWeight?: number | null;
    performedWeightUnit?: string | null;
    restSecondsActual?: number | null;
    rpe?: number | null;
    sequence: number;
    setNumber: number;
    workoutTemplateExerciseId?: string | null;
  };

  const id = createId("setlog");
  const now = nowIsoString();

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO exercise_set_logs (
            id,
            workout_session_id,
            exercise_id,
            workout_template_exercise_id,
            sequence,
            set_number,
            performed_reps,
            performed_weight,
            performed_weight_unit,
            performed_duration_seconds,
            performed_distance_meters,
            rest_seconds_actual,
            rpe,
            completed,
            notes,
            logged_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        params.sessionId,
        body.exerciseId,
        body.workoutTemplateExerciseId ?? null,
        body.sequence,
        body.setNumber,
        body.performedReps ?? null,
        body.performedWeight ?? null,
        body.performedWeightUnit ?? null,
        body.performedDurationSeconds ?? null,
        body.performedDistanceMeters ?? null,
        body.restSecondsActual ?? null,
        body.rpe ?? null,
        toSqliteBoolean(body.completed) ?? 1,
        body.notes ?? null,
        now,
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return sendBadRequest(
        reply,
        "WORKOUT_SESSION_SET_DUPLICATE",
        "A set with this sequence and set number already exists for the session.",
      );
    }
    throw error;
  }

  request.server.db
    .prepare("UPDATE workout_sessions SET updated_at = ? WHERE id = ?")
    .run(now, params.sessionId);

  const row = request.server.db
    .prepare(
      `
        SELECT exercise_set_logs.*, exercises.name AS exercise_name
        FROM exercise_set_logs
        INNER JOIN exercises ON exercises.id = exercise_set_logs.exercise_id
        WHERE exercise_set_logs.id = ?
      `,
    )
    .get(id) as SetLogRow;

  return reply.code(201).send(mapWorkoutSessionSetLogRow(row));
}

async function updateSetLog(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string; setId: string };
  const existing = ensureSessionExists(request, params.sessionId, userId);
  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  const body = request.body as {
    completed?: boolean;
    notes?: string | null;
    performedDistanceMeters?: number | null;
    performedDurationSeconds?: number | null;
    performedReps?: number | null;
    performedWeight?: number | null;
    performedWeightUnit?: string | null;
    restSecondsActual?: number | null;
    rpe?: number | null;
  };

  const assignments: string[] = [];
  const values: Array<string | number | null> = [];

  if (body.performedReps !== undefined) {
    assignments.push("performed_reps = ?");
    values.push(body.performedReps);
  }
  if (body.performedWeight !== undefined) {
    assignments.push("performed_weight = ?");
    values.push(body.performedWeight);
  }
  if (body.performedWeightUnit !== undefined) {
    assignments.push("performed_weight_unit = ?");
    values.push(body.performedWeightUnit);
  }
  if (body.performedDurationSeconds !== undefined) {
    assignments.push("performed_duration_seconds = ?");
    values.push(body.performedDurationSeconds);
  }
  if (body.performedDistanceMeters !== undefined) {
    assignments.push("performed_distance_meters = ?");
    values.push(body.performedDistanceMeters);
  }
  if (body.restSecondsActual !== undefined) {
    assignments.push("rest_seconds_actual = ?");
    values.push(body.restSecondsActual);
  }
  if (body.rpe !== undefined) {
    assignments.push("rpe = ?");
    values.push(body.rpe);
  }
  if (body.completed !== undefined) {
    assignments.push("completed = ?");
    values.push(toSqliteBoolean(body.completed) ?? 1);
  }
  if (body.notes !== undefined) {
    assignments.push("notes = ?");
    values.push(body.notes);
  }

  if (assignments.length === 0) {
    const row = request.server.db
      .prepare(
        `
          SELECT exercise_set_logs.*, exercises.name AS exercise_name
          FROM exercise_set_logs
          INNER JOIN exercises ON exercises.id = exercise_set_logs.exercise_id
          WHERE exercise_set_logs.id = ? AND exercise_set_logs.workout_session_id = ?
          LIMIT 1
        `,
      )
      .get(params.setId, params.sessionId) as SetLogRow | undefined;

    if (!row) {
      return sendNotFound(
        reply,
        "WORKOUT_SESSION_SET_NOT_FOUND",
        "Workout set log not found.",
      );
    }

    return mapWorkoutSessionSetLogRow(row);
  }

  const result = request.server.db
    .prepare(
      `
        UPDATE exercise_set_logs
        SET ${assignments.join(", ")}
        WHERE id = ? AND workout_session_id = ?
      `,
    )
    .run(...values, params.setId, params.sessionId);

  if (result.changes === 0) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_SET_NOT_FOUND",
      "Workout set log not found.",
    );
  }

  request.server.db
    .prepare("UPDATE workout_sessions SET updated_at = ? WHERE id = ?")
    .run(nowIsoString(), params.sessionId);

  const row = request.server.db
    .prepare(
      `
        SELECT exercise_set_logs.*, exercises.name AS exercise_name
        FROM exercise_set_logs
        INNER JOIN exercises ON exercises.id = exercise_set_logs.exercise_id
        WHERE exercise_set_logs.id = ?
      `,
    )
    .get(params.setId) as SetLogRow;

  return mapWorkoutSessionSetLogRow(row);
}

async function completeMySession(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string };
  const existing = ensureSessionExists(request, params.sessionId, userId);
  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  const body =
    (request.body as
      | {
          completedAt?: string;
          durationSeconds?: number | null;
          notes?: string | null;
        }
      | undefined) ?? {};
  const now = nowIsoString();
  const completedAt = body.completedAt ?? now;

  request.server.db
    .prepare(
      `
        UPDATE workout_sessions
        SET status = 'completed',
            completed_at = ?,
            duration_seconds = COALESCE(?, duration_seconds),
            notes = COALESCE(?, notes),
            updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(
      completedAt,
      body.durationSeconds ?? null,
      body.notes ?? null,
      now,
      params.sessionId,
      userId,
    );

  return getSessionDetailForUser(request, params.sessionId, userId);
}

async function submitFeedback(request: FastifyRequest, reply: FastifyReply) {
  const userId = getUserId(request);
  if (!userId) return reply;
  const params = request.params as { sessionId: string };
  const existing = ensureSessionExists(request, params.sessionId, userId);
  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_SESSION_NOT_FOUND",
      "Workout session not found.",
    );
  }

  const body =
    (request.body as
      | {
          difficultyRating?: number | null;
          energyRating?: number | null;
          freeText?: string | null;
          mood?: string | null;
          painFlag?: boolean;
          painNotes?: string | null;
        }
      | undefined) ?? {};
  const feedbackId = createId("feedback");
  const now = nowIsoString();

  request.server.db
    .prepare(
      `
        INSERT INTO workout_feedback (
          id,
          workout_session_id,
          user_id,
          mood,
          difficulty_rating,
          energy_rating,
          pain_flag,
          pain_notes,
          free_text,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workout_session_id) DO UPDATE SET
          mood = excluded.mood,
          difficulty_rating = excluded.difficulty_rating,
          energy_rating = excluded.energy_rating,
          pain_flag = excluded.pain_flag,
          pain_notes = excluded.pain_notes,
          free_text = excluded.free_text,
          submitted_at = excluded.submitted_at
      `,
    )
    .run(
      feedbackId,
      params.sessionId,
      userId,
      body.mood ?? null,
      body.difficultyRating ?? null,
      body.energyRating ?? null,
      toSqliteBoolean(body.painFlag) ?? 0,
      body.painNotes ?? null,
      body.freeText ?? null,
      now,
    );

  return mapFeedback(
    getWorkoutSessionDetail(request.server.db, {
      sessionId: params.sessionId,
      userId,
    })?.feedback ?? null,
  );
}

export function userWorkoutRoutes({
  apiBasePath,
}: UserRouteOptions): AppRouteDefinition[] {
  const security = [{ sessionCookieAuth: [] }];
  const authHandler = requireUserSession();

  return [
    {
      method: "GET",
      operationId: "getMyWorkoutsToday",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: {
          type: "object",
          required: ["date", "items"],
          properties: {
            date: dateSchema,
            items: { type: "array", items: assignmentSchema },
          },
        },
        401: errorResponseSchema,
      },
      summary: "List today's assigned workouts for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workouts/today`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "List today's assigned workouts for the current user.",
        querystring: todayQuerySchema,
        response: {
          200: {
            type: "object",
            required: ["date", "items"],
            properties: {
              date: dateSchema,
              items: { type: "array", items: assignmentSchema },
            },
          },
          401: errorResponseSchema,
        },
      }),
      handler: getTodayWorkouts,
      security,
    },
    {
      method: "GET",
      operationId: "listMyWorkouts",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: {
          type: "object",
          required: ["items"],
          properties: { items: { type: "array", items: assignmentSchema } },
        },
        401: errorResponseSchema,
      },
      summary: "List all workout assignments for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workouts`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "List all workout assignments for the current user.",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: { items: { type: "array", items: assignmentSchema } },
          },
          401: errorResponseSchema,
        },
      }),
      handler: listMyWorkouts,
      security,
    },
    {
      method: "GET",
      operationId: "getMyWorkoutDetail",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: workoutTemplateDetailSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get a workout template that is assigned to the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workouts/:workoutId`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Get a workout template that is assigned to the current user.",
        params: workoutIdParamsSchema,
        response: {
          200: workoutTemplateDetailSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getMyWorkoutDetail,
      security,
    },
    {
      method: "GET",
      operationId: "listMyExercises",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: {
          type: "object",
          required: ["items"],
          properties: { items: { type: "array", items: exerciseDetailSchema } },
        },
        401: errorResponseSchema,
      },
      summary: "List exercises referenced by assigned workouts.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/exercises`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "List exercises referenced by assigned workouts.",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: { type: "array", items: exerciseDetailSchema },
            },
          },
          401: errorResponseSchema,
        },
      }),
      handler: listMyExercises,
      security,
    },
    {
      method: "GET",
      operationId: "getMyExerciseDetail",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: exerciseDetailSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get exercise detail with media for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/exercises/:exerciseId`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Get exercise detail with media for the current user.",
        params: exerciseIdParamsSchema,
        response: {
          200: exerciseDetailSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getMyExerciseDetail,
      security,
    },
    {
      method: "GET",
      operationId: "listMyWorkoutSessions",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: {
          type: "object",
          required: ["items", "limit", "offset", "total"],
          properties: {
            items: { type: "array", items: sessionSchema },
            limit: { type: "integer" },
            offset: { type: "integer" },
            total: { type: "integer" },
          },
        },
        401: errorResponseSchema,
      },
      summary: "List workout sessions for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "List workout sessions for the current user.",
        querystring: sessionListQuerySchema,
        response: {
          200: {
            type: "object",
            required: ["items", "limit", "offset", "total"],
            properties: {
              items: { type: "array", items: sessionSchema },
              limit: { type: "integer" },
              offset: { type: "integer" },
              total: { type: "integer" },
            },
          },
          401: errorResponseSchema,
        },
      }),
      handler: listMyWorkoutSessions,
      security,
    },
    {
      method: "POST",
      operationId: "createMyWorkoutSession",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        201: sessionSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Create an in-progress workout session for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Create an in-progress workout session for the current user.",
        body: createSessionBodySchema,
        response: {
          201: sessionSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: createMyWorkoutSession,
      security,
    },
    {
      method: "GET",
      operationId: "getMyWorkoutSession",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: sessionSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Retrieve a workout session for the current user.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Retrieve a workout session for the current user.",
        params: sessionIdParamsSchema,
        response: {
          200: sessionSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getMyWorkoutSession,
      security,
    },
    {
      method: "PATCH",
      operationId: "updateMyWorkoutSession",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: sessionSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Update status, notes, or timing of a workout session.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Update status, notes, or timing of a workout session.",
        params: sessionIdParamsSchema,
        body: updateSessionBodySchema,
        response: {
          200: sessionSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: updateMyWorkoutSession,
      security,
    },
    {
      method: "POST",
      operationId: "createMyWorkoutSet",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        201: setLogSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Record a performed set within a workout session.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId/sets`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Record a performed set within a workout session.",
        params: sessionIdParamsSchema,
        body: createSetBodySchema,
        response: {
          201: setLogSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: createSetLog,
      security,
    },
    {
      method: "PATCH",
      operationId: "updateMyWorkoutSet",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: setLogSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Update a previously recorded workout set.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId/sets/:setId`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Update a previously recorded workout set.",
        params: sessionSetParamsSchema,
        body: updateSetBodySchema,
        response: {
          200: setLogSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: updateSetLog,
      security,
    },
    {
      method: "POST",
      operationId: "completeMyWorkoutSession",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: sessionSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Mark a workout session as completed.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId/complete`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Mark a workout session as completed.",
        params: sessionIdParamsSchema,
        body: completeSessionBodySchema,
        response: {
          200: sessionSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: completeMySession,
      security,
    },
    {
      method: "POST",
      operationId: "submitMyWorkoutFeedback",
      preHandler: authHandler,
      responseContentType: "application/json",
      response: {
        200: feedbackSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Submit or update feedback for a workout session.",
      tags: ["user-workouts"],
      url: `${apiBasePath}/me/workout-sessions/:sessionId/feedback`,
      schema: buildRouteSchema({
        tags: ["user-workouts"],
        summary: "Submit or update feedback for a workout session.",
        params: sessionIdParamsSchema,
        body: feedbackBodySchema,
        response: {
          200: feedbackSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: submitFeedback,
      security,
    },
  ];
}
