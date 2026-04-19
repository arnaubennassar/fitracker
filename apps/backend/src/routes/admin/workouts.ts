import type { FastifyReply, FastifyRequest } from "fastify";

import { requireAdminAuth } from "../auth.js";
import type { AppRouteDefinition } from "../registry.js";
import { buildRouteSchema } from "../registry.js";
import type { AdminRouteOptions, PaginationQuery } from "./shared.js";
import {
  buildListResponseSchema,
  createId,
  dateTimeSchema,
  errorResponseSchema,
  getPagination,
  handleSqliteError,
  idParamSchema,
  nowIsoString,
  nullableIntegerSchema,
  nullableNumberSchema,
  nullableStringSchema,
  paginationQuerySchema,
  sendBadRequest,
  sendNotFound,
  toBoolean,
  toSqliteBoolean,
} from "./shared.js";

type WorkoutTemplateRow = {
  created_at: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate" | null;
  estimated_duration_min: number | null;
  exercise_count?: number;
  goal: string | null;
  id: string;
  is_active: number;
  name: string;
  slug: string;
  updated_at: string;
};

type WorkoutTemplateExerciseRow = {
  block_label: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate";
  exercise_id: string;
  exercise_name: string;
  exercise_slug: string;
  id: string;
  instruction_override: string | null;
  is_optional: number;
  rest_seconds: number | null;
  rir_target: number | null;
  rpe_target: number | null;
  sequence: number;
  target_distance_meters: number | null;
  target_duration_seconds: number | null;
  target_reps: number | null;
  target_reps_max: number | null;
  target_reps_min: number | null;
  target_sets: number | null;
  target_weight: number | null;
  target_weight_unit: string | null;
  tempo: string | null;
  tracking_mode: "distance" | "mixed" | "reps" | "time";
  workout_template_id: string;
};

type WorkoutTemplateBody = {
  description?: string | null;
  difficulty?: "advanced" | "beginner" | "intermediate" | null;
  estimatedDurationMin?: number | null;
  exercises?: Array<WorkoutTemplateExerciseBody & { id?: string }>;
  goal?: string | null;
  id?: string;
  isActive?: boolean;
  name: string;
  slug: string;
};

type WorkoutTemplateExerciseBody = {
  blockLabel: string;
  exerciseId: string;
  id?: string;
  instructionOverride?: string | null;
  isOptional?: boolean;
  restSeconds?: number | null;
  rirTarget?: number | null;
  rpeTarget?: number | null;
  sequence: number;
  targetDistanceMeters?: number | null;
  targetDurationSeconds?: number | null;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetRepsMin?: number | null;
  targetSets?: number | null;
  targetWeight?: number | null;
  targetWeightUnit?: string | null;
  tempo?: string | null;
};

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
    "isActive",
    "createdAt",
    "updatedAt",
    "exerciseCount",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
    goal: nullableStringSchema,
    estimatedDurationMin: nullableIntegerSchema,
    difficulty: {
      anyOf: [
        { type: "string", enum: ["advanced", "beginner", "intermediate"] },
        { type: "null" },
      ],
    },
    isActive: { type: "boolean" },
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    exerciseCount: { type: "integer" },
  },
} as const;

const workoutTemplateExerciseSchema = {
  type: "object",
  required: [
    "id",
    "workoutTemplateId",
    "exercise",
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
  ],
  properties: {
    id: { type: "string" },
    workoutTemplateId: { type: "string" },
    exercise: {
      type: "object",
      required: [
        "id",
        "name",
        "slug",
        "trackingMode",
        "difficulty",
        "description",
      ],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
        trackingMode: {
          type: "string",
          enum: ["distance", "mixed", "reps", "time"],
        },
        difficulty: {
          type: "string",
          enum: ["advanced", "beginner", "intermediate"],
        },
        description: nullableStringSchema,
      },
    },
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
  },
} as const;

const workoutTemplateDetailSchema = {
  type: "object",
  required: [...workoutTemplateSchema.required, "exercises"],
  properties: {
    ...workoutTemplateSchema.properties,
    exercises: {
      type: "array",
      items: workoutTemplateExerciseSchema,
    },
  },
} as const;

const workoutTemplateBodySchema = {
  type: "object",
  required: ["slug", "name"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    slug: { type: "string", minLength: 2, maxLength: 120 },
    name: { type: "string", minLength: 2, maxLength: 120 },
    description: {
      anyOf: [{ type: "string", maxLength: 1000 }, { type: "null" }],
    },
    goal: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
    estimatedDurationMin: {
      anyOf: [{ type: "integer", minimum: 1, maximum: 360 }, { type: "null" }],
    },
    difficulty: {
      anyOf: [
        { type: "string", enum: ["advanced", "beginner", "intermediate"] },
        { type: "null" },
      ],
    },
    isActive: { type: "boolean" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["exerciseId", "sequence", "blockLabel"],
        properties: {
          id: { type: "string" },
          exerciseId: { type: "string", minLength: 1 },
          sequence: { type: "integer", minimum: 1 },
          blockLabel: { type: "string", minLength: 1 },
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
        },
      },
    },
  },
} as const;

const workoutTemplateExerciseBodySchema = {
  type: "object",
  required: ["exerciseId", "sequence", "blockLabel"],
  additionalProperties: false,
  properties: {
    exerciseId: { type: "string", minLength: 1 },
    sequence: { type: "integer", minimum: 1 },
    blockLabel: { type: "string", minLength: 1 },
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
  },
} as const;

const workoutIdParamsSchema = {
  type: "object",
  required: ["workoutId"],
  additionalProperties: false,
  properties: {
    workoutId: { type: "string", minLength: 1 },
  },
} as const;

const deleteSchema = {
  type: "object",
  required: ["deleted", "id"],
  properties: {
    deleted: { type: "boolean" },
    id: { type: "string" },
  },
} as const;

const deleteExerciseSchema = {
  type: "object",
  required: ["deleted", "id", "workoutTemplateId"],
  properties: {
    deleted: { type: "boolean" },
    id: { type: "string" },
    workoutTemplateId: { type: "string" },
  },
} as const;

function mapTemplate(row: WorkoutTemplateRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    goal: row.goal,
    estimatedDurationMin: row.estimated_duration_min,
    difficulty: row.difficulty,
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exerciseCount: row.exercise_count ?? 0,
  };
}

function mapTemplateExercise(row: WorkoutTemplateExerciseRow) {
  return {
    id: row.id,
    workoutTemplateId: row.workout_template_id,
    exercise: {
      id: row.exercise_id,
      name: row.exercise_name,
      slug: row.exercise_slug,
      trackingMode: row.tracking_mode,
      difficulty: row.difficulty,
      description: row.description,
    },
    sequence: row.sequence,
    blockLabel: row.block_label,
    instructionOverride: row.instruction_override,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    targetWeight: row.target_weight,
    targetWeightUnit: row.target_weight_unit,
    targetDurationSeconds: row.target_duration_seconds,
    targetDistanceMeters: row.target_distance_meters,
    restSeconds: row.rest_seconds,
    tempo: row.tempo,
    rpeTarget: row.rpe_target,
    rirTarget: row.rir_target,
    isOptional: toBoolean(row.is_optional),
  };
}

function getWorkoutTemplateDetail(request: FastifyRequest, workoutId: string) {
  const row = request.server.db
    .prepare(
      `
        SELECT workout_templates.*, COUNT(workout_template_exercises.id) AS exercise_count
        FROM workout_templates
        LEFT JOIN workout_template_exercises
          ON workout_template_exercises.workout_template_id = workout_templates.id
        WHERE workout_templates.id = ?
        GROUP BY workout_templates.id
      `,
    )
    .get(workoutId) as WorkoutTemplateRow | undefined;

  if (!row) {
    return null;
  }

  const exercises = request.server.db
    .prepare(
      `
        SELECT
          workout_template_exercises.*,
          exercises.slug AS exercise_slug,
          exercises.name AS exercise_name,
          exercises.tracking_mode,
          exercises.difficulty,
          exercises.description
        FROM workout_template_exercises
        INNER JOIN exercises
          ON exercises.id = workout_template_exercises.exercise_id
        WHERE workout_template_exercises.workout_template_id = ?
        ORDER BY sequence ASC, id ASC
      `,
    )
    .all(workoutId) as WorkoutTemplateExerciseRow[];

  return {
    ...mapTemplate(row),
    exercises: exercises.map(mapTemplateExercise),
  };
}

function validateExerciseBody(
  reply: FastifyReply,
  body: WorkoutTemplateExerciseBody,
) {
  if (
    body.targetRepsMin != null &&
    body.targetRepsMax != null &&
    body.targetRepsMin > body.targetRepsMax
  ) {
    return sendBadRequest(
      reply,
      "WORKOUT_TEMPLATE_EXERCISE_REP_RANGE_INVALID",
      "targetRepsMin cannot be greater than targetRepsMax.",
    );
  }

  if (
    body.targetReps != null &&
    (body.targetRepsMin != null || body.targetRepsMax != null)
  ) {
    return sendBadRequest(
      reply,
      "WORKOUT_TEMPLATE_EXERCISE_REPS_AMBIGUOUS",
      "Use either targetReps or a min/max rep range, not both.",
    );
  }

  return null;
}

async function listTemplates(request: FastifyRequest) {
  const query = request.query as PaginationQuery;
  const { limit, offset, search } = getPagination(query);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    conditions.push(
      "(workout_templates.name LIKE ? COLLATE NOCASE OR workout_templates.slug LIKE ? COLLATE NOCASE OR workout_templates.goal LIKE ? COLLATE NOCASE)",
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (query.isActive !== undefined) {
    conditions.push("workout_templates.is_active = ?");
    params.push(Number(query.isActive));
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const items = request.server.db
    .prepare(
      `
        SELECT workout_templates.*, COUNT(workout_template_exercises.id) AS exercise_count
        FROM workout_templates
        LEFT JOIN workout_template_exercises
          ON workout_template_exercises.workout_template_id = workout_templates.id
        ${whereClause}
        GROUP BY workout_templates.id
        ORDER BY workout_templates.updated_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...params, limit, offset) as WorkoutTemplateRow[];
  const total = request.server.db
    .prepare(`SELECT COUNT(*) AS count FROM workout_templates ${whereClause}`)
    .get(...params) as { count: number };

  return {
    items: items.map(mapTemplate),
    pagination: {
      limit,
      offset,
      total: total.count,
    },
  };
}

async function createTemplate(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as WorkoutTemplateBody;
  const id = body.id ?? createId("workout");
  const now = nowIsoString();

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO workout_templates (
            id,
            slug,
            name,
            description,
            goal,
            estimated_duration_min,
            difficulty,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        body.slug,
        body.name,
        body.description ?? null,
        body.goal ?? null,
        body.estimatedDurationMin ?? null,
        body.difficulty ?? null,
        toSqliteBoolean(body.isActive) ?? 1,
        now,
        now,
      );

    if (Array.isArray(body.exercises)) {
      for (const exercise of body.exercises) {
        const validationError = validateExerciseBody(reply, exercise);
        if (validationError) {
          return validationError;
        }

        request.server.db
          .prepare(
            `
              INSERT INTO workout_template_exercises (
                id,
                workout_template_id,
                exercise_id,
                sequence,
                block_label,
                instruction_override,
                target_sets,
                target_reps,
                target_reps_min,
                target_reps_max,
                target_weight,
                target_weight_unit,
                target_duration_seconds,
                target_distance_meters,
                rest_seconds,
                tempo,
                rpe_target,
                rir_target,
                is_optional
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            exercise.id ?? createId("workout_exercise"),
            id,
            exercise.exerciseId,
            exercise.sequence,
            exercise.blockLabel,
            exercise.instructionOverride ?? null,
            exercise.targetSets ?? null,
            exercise.targetReps ?? null,
            exercise.targetRepsMin ?? null,
            exercise.targetRepsMax ?? null,
            exercise.targetWeight ?? null,
            exercise.targetWeightUnit ?? null,
            exercise.targetDurationSeconds ?? null,
            exercise.targetDistanceMeters ?? null,
            exercise.restSeconds ?? null,
            exercise.tempo ?? null,
            exercise.rpeTarget ?? null,
            exercise.rirTarget ?? null,
            toSqliteBoolean(exercise.isOptional) ?? 0,
          );
      }
    }
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "WORKOUT_TEMPLATE_CONFLICT",
      conflictMessage:
        "Workout template conflicts with an existing slug or resource.",
    });
  }

  return reply.code(201).send(getWorkoutTemplateDetail(request, id));
}

async function getTemplate(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { workoutId: string };
  const item = getWorkoutTemplateDetail(request, params.workoutId);

  return (
    item ??
    sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_NOT_FOUND",
      "Workout template not found.",
    )
  );
}

async function updateTemplate(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { workoutId: string };
  const body = request.body as WorkoutTemplateBody;

  try {
    const result = request.server.db
      .prepare(
        `
          UPDATE workout_templates
          SET
            slug = ?,
            name = ?,
            description = ?,
            goal = ?,
            estimated_duration_min = ?,
            difficulty = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        body.slug,
        body.name,
        body.description ?? null,
        body.goal ?? null,
        body.estimatedDurationMin ?? null,
        body.difficulty ?? null,
        toSqliteBoolean(body.isActive) ?? 1,
        nowIsoString(),
        params.workoutId,
      );

    if (result.changes === 0) {
      return sendNotFound(
        reply,
        "WORKOUT_TEMPLATE_NOT_FOUND",
        "Workout template not found.",
      );
    }
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "WORKOUT_TEMPLATE_UPDATE_CONFLICT",
      conflictMessage:
        "Workout template update conflicts with an existing resource.",
    });
  }

  return getWorkoutTemplateDetail(request, params.workoutId);
}

async function deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { workoutId: string };

  try {
    const result = request.server.db
      .prepare("DELETE FROM workout_templates WHERE id = ?")
      .run(params.workoutId);

    if (result.changes === 0) {
      return sendNotFound(
        reply,
        "WORKOUT_TEMPLATE_NOT_FOUND",
        "Workout template not found.",
      );
    }
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "WORKOUT_TEMPLATE_DELETE_CONFLICT",
      conflictMessage:
        "Workout template cannot be deleted while assignments or sessions still reference it.",
    });
  }

  return { deleted: true, id: params.workoutId };
}

async function createTemplateExercise(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { workoutId: string };
  const body = request.body as WorkoutTemplateExerciseBody;
  const validationError = validateExerciseBody(reply, body);

  if (validationError) {
    return validationError;
  }

  const id = createId("workout_exercise");

  try {
    request.server.db
      .prepare(
        `
          INSERT INTO workout_template_exercises (
            id,
            workout_template_id,
            exercise_id,
            sequence,
            block_label,
            instruction_override,
            target_sets,
            target_reps,
            target_reps_min,
            target_reps_max,
            target_weight,
            target_weight_unit,
            target_duration_seconds,
            target_distance_meters,
            rest_seconds,
            tempo,
            rpe_target,
            rir_target,
            is_optional
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        params.workoutId,
        body.exerciseId,
        body.sequence,
        body.blockLabel,
        body.instructionOverride ?? null,
        body.targetSets ?? null,
        body.targetReps ?? null,
        body.targetRepsMin ?? null,
        body.targetRepsMax ?? null,
        body.targetWeight ?? null,
        body.targetWeightUnit ?? null,
        body.targetDurationSeconds ?? null,
        body.targetDistanceMeters ?? null,
        body.restSeconds ?? null,
        body.tempo ?? null,
        body.rpeTarget ?? null,
        body.rirTarget ?? null,
        toSqliteBoolean(body.isOptional) ?? 0,
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "WORKOUT_TEMPLATE_EXERCISE_CONFLICT",
      conflictMessage:
        "Workout exercise conflicts with an existing sequence or missing reference.",
    });
  }

  return reply
    .code(201)
    .send(getWorkoutTemplateDetail(request, params.workoutId));
}

async function updateTemplateExercise(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { id: string };
  const body = request.body as WorkoutTemplateExerciseBody;
  const validationError = validateExerciseBody(reply, body);

  if (validationError) {
    return validationError;
  }

  const existing = request.server.db
    .prepare(
      "SELECT workout_template_id FROM workout_template_exercises WHERE id = ?",
    )
    .get(params.id) as { workout_template_id: string } | undefined;

  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND",
      "Workout template exercise not found.",
    );
  }

  try {
    request.server.db
      .prepare(
        `
          UPDATE workout_template_exercises
          SET
            exercise_id = ?,
            sequence = ?,
            block_label = ?,
            instruction_override = ?,
            target_sets = ?,
            target_reps = ?,
            target_reps_min = ?,
            target_reps_max = ?,
            target_weight = ?,
            target_weight_unit = ?,
            target_duration_seconds = ?,
            target_distance_meters = ?,
            rest_seconds = ?,
            tempo = ?,
            rpe_target = ?,
            rir_target = ?,
            is_optional = ?
          WHERE id = ?
        `,
      )
      .run(
        body.exerciseId,
        body.sequence,
        body.blockLabel,
        body.instructionOverride ?? null,
        body.targetSets ?? null,
        body.targetReps ?? null,
        body.targetRepsMin ?? null,
        body.targetRepsMax ?? null,
        body.targetWeight ?? null,
        body.targetWeightUnit ?? null,
        body.targetDurationSeconds ?? null,
        body.targetDistanceMeters ?? null,
        body.restSeconds ?? null,
        body.tempo ?? null,
        body.rpeTarget ?? null,
        body.rirTarget ?? null,
        toSqliteBoolean(body.isOptional) ?? 0,
        params.id,
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "WORKOUT_TEMPLATE_EXERCISE_UPDATE_CONFLICT",
      conflictMessage:
        "Workout template exercise update conflicts with an existing sequence or missing reference.",
    });
  }

  return getWorkoutTemplateDetail(request, existing.workout_template_id);
}

async function deleteTemplateExercise(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { id: string };
  const existing = request.server.db
    .prepare(
      "SELECT workout_template_id FROM workout_template_exercises WHERE id = ?",
    )
    .get(params.id) as { workout_template_id: string } | undefined;

  if (!existing) {
    return sendNotFound(
      reply,
      "WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND",
      "Workout template exercise not found.",
    );
  }

  request.server.db
    .prepare("DELETE FROM workout_template_exercises WHERE id = ?")
    .run(params.id);

  return {
    deleted: true,
    id: params.id,
    workoutTemplateId: existing.workout_template_id,
  };
}

export function adminWorkoutRoutes({
  apiBasePath,
}: AdminRouteOptions): AppRouteDefinition[] {
  const auth = requireAdminAuth();

  return [
    {
      method: "GET",
      operationId: "listWorkoutTemplates",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: buildListResponseSchema(workoutTemplateSchema),
        401: errorResponseSchema,
      },
      summary: "List workout templates.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "List workout templates.",
        querystring: paginationQuerySchema,
        response: {
          200: buildListResponseSchema(workoutTemplateSchema),
          401: errorResponseSchema,
        },
      }),
      handler: listTemplates,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createWorkoutTemplate",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: workoutTemplateDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create a workout template.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Create a workout template.",
        body: workoutTemplateBodySchema,
        response: {
          201: workoutTemplateDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createTemplate,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "getWorkoutTemplate",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: workoutTemplateDetailSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get a workout template with ordered exercises.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates/:workoutId`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Get a workout template with ordered exercises.",
        params: workoutIdParamsSchema,
        response: {
          200: workoutTemplateDetailSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getTemplate,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateWorkoutTemplate",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: workoutTemplateDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Update a workout template.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates/:workoutId`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Update a workout template.",
        params: workoutIdParamsSchema,
        body: workoutTemplateBodySchema,
        response: {
          200: workoutTemplateDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: updateTemplate,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteWorkoutTemplate",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: deleteSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Delete a workout template.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates/:workoutId`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Delete a workout template.",
        params: workoutIdParamsSchema,
        response: {
          200: deleteSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: deleteTemplate,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createWorkoutTemplateExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: workoutTemplateDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Add an ordered exercise to a workout template.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-templates/:workoutId/exercises`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Add an ordered exercise to a workout template.",
        params: workoutIdParamsSchema,
        body: workoutTemplateExerciseBodySchema,
        response: {
          201: workoutTemplateDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createTemplateExercise,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateWorkoutTemplateExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: workoutTemplateDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Update one workout template exercise entry.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-template-exercises/:id`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Update one workout template exercise entry.",
        params: idParamSchema,
        body: workoutTemplateExerciseBodySchema,
        response: {
          200: workoutTemplateDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: updateTemplateExercise,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteWorkoutTemplateExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: deleteExerciseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Delete one workout template exercise entry.",
      tags: ["admin-workouts"],
      url: `${apiBasePath}/admin/workout-template-exercises/:id`,
      schema: buildRouteSchema({
        tags: ["admin-workouts"],
        summary: "Delete one workout template exercise entry.",
        params: idParamSchema,
        response: {
          200: deleteExerciseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: deleteTemplateExercise,
      security: [{ bearerAuth: [] }],
    },
  ];
}
