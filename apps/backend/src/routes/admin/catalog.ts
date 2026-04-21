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
  nullableStringSchema,
  paginationQuerySchema,
  parseJson,
  sendNotFound,
  stringArraySchema,
  toBoolean,
  toSqliteBoolean,
} from "./shared.js";

type CategoryRow = {
  description: string | null;
  exercise_count?: number;
  id: string;
  name: string;
};
type ExerciseRow = {
  category_description: string | null;
  category_id: string;
  category_name: string;
  created_at: string;
  description: string | null;
  difficulty: "advanced" | "beginner" | "intermediate";
  equipment: string;
  id: string;
  instructions: string;
  is_active: number;
  media_count?: number;
  name: string;
  primary_muscles: string;
  secondary_muscles: string;
  slug: string;
  tracking_mode: "distance" | "mixed" | "reps" | "time";
  updated_at: string;
};
type MediaRow = {
  created_at: string | null;
  duration_seconds: number | null;
  exercise_id: string;
  id: string;
  mime_type: string | null;
  sort_order: number;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

type CategoryBody = {
  description?: string | null;
  id?: string;
  name: string;
};

type MediaBody = {
  id?: string;
  durationSeconds?: number | null;
  mimeType?: string | null;
  sortOrder?: number;
  thumbnailUrl?: string | null;
  type: "image" | "video";
  url: string;
};

type ExerciseBody = {
  categoryId: string;
  description?: string | null;
  difficulty: "advanced" | "beginner" | "intermediate";
  equipment: string[];
  id?: string;
  instructions: string;
  isActive?: boolean;
  media?: MediaBody[];
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  slug: string;
  trackingMode: "distance" | "mixed" | "reps" | "time";
};
const categorySchema = {
  type: "object",
  required: ["id", "name", "description", "exerciseCount"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
    exerciseCount: { type: "integer" },
  },
} as const;
const categoryRefSchema = {
  type: "object",
  required: ["id", "name", "description"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
  },
} as const;
const categoryBodySchema = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string", minLength: 2, maxLength: 80 },
    description: {
      anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }],
    },
  },
} as const;
const mediaSchema = {
  type: "object",
  required: [
    "id",
    "exerciseId",
    "type",
    "url",
    "mimeType",
    "durationSeconds",
    "thumbnailUrl",
    "sortOrder",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    exerciseId: { type: "string" },
    type: { type: "string", enum: ["image", "video"] },
    url: { type: "string" },
    mimeType: nullableStringSchema,
    durationSeconds: nullableIntegerSchema,
    thumbnailUrl: nullableStringSchema,
    sortOrder: { type: "integer" },
    createdAt: { anyOf: [dateTimeSchema, { type: "null" }] },
  },
} as const;
const exerciseSchema = {
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
    "createdAt",
    "updatedAt",
    "mediaCount",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    category: categoryRefSchema,
    description: nullableStringSchema,
    instructions: { type: "string" },
    equipment: stringArraySchema,
    trackingMode: {
      type: "string",
      enum: ["distance", "mixed", "reps", "time"],
    },
    difficulty: {
      type: "string",
      enum: ["advanced", "beginner", "intermediate"],
    },
    primaryMuscles: stringArraySchema,
    secondaryMuscles: stringArraySchema,
    isActive: { type: "boolean" },
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    mediaCount: { type: "integer" },
  },
} as const;
const exerciseDetailSchema = {
  type: "object",
  required: [...exerciseSchema.required, "media"],
  properties: {
    ...exerciseSchema.properties,
    media: { type: "array", items: mediaSchema },
  },
} as const;
const exerciseBodySchema = {
  type: "object",
  required: [
    "slug",
    "name",
    "categoryId",
    "instructions",
    "trackingMode",
    "difficulty",
    "equipment",
    "primaryMuscles",
    "secondaryMuscles",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    slug: { type: "string", minLength: 2, maxLength: 120 },
    name: { type: "string", minLength: 2, maxLength: 120 },
    categoryId: { type: "string", minLength: 1 },
    description: {
      anyOf: [{ type: "string", maxLength: 1000 }, { type: "null" }],
    },
    instructions: { type: "string", minLength: 1, maxLength: 4000 },
    equipment: stringArraySchema,
    trackingMode: {
      type: "string",
      enum: ["distance", "mixed", "reps", "time"],
    },
    difficulty: {
      type: "string",
      enum: ["advanced", "beginner", "intermediate"],
    },
    primaryMuscles: stringArraySchema,
    secondaryMuscles: stringArraySchema,
    isActive: { type: "boolean" },
    media: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "url"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["image", "video"] },
          url: { type: "string" },
          mimeType: nullableStringSchema,
          durationSeconds: nullableIntegerSchema,
          thumbnailUrl: nullableStringSchema,
          sortOrder: { type: "integer", minimum: 0 },
        },
      },
    },
  },
} as const;
const mediaBodySchema = {
  type: "object",
  required: ["type", "url"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["image", "video"] },
    url: { type: "string", minLength: 1 },
    mimeType: { anyOf: [{ type: "string" }, { type: "null" }] },
    durationSeconds: nullableIntegerSchema,
    thumbnailUrl: nullableStringSchema,
    sortOrder: { type: "integer", minimum: 0 },
  },
} as const;
const exerciseIdParamsSchema = {
  type: "object",
  required: ["exerciseId"],
  additionalProperties: false,
  properties: { exerciseId: { type: "string", minLength: 1 } },
} as const;
const mediaParamsSchema = {
  type: "object",
  required: ["exerciseId", "mediaId"],
  additionalProperties: false,
  properties: {
    exerciseId: { type: "string", minLength: 1 },
    mediaId: { type: "string", minLength: 1 },
  },
} as const;
const deleteSchema = {
  type: "object",
  required: ["deleted", "id"],
  properties: { deleted: { type: "boolean" }, id: { type: "string" } },
} as const;
function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    exerciseCount: row.exercise_count ?? 0,
  };
}
function mapMedia(row: MediaRow) {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    type: row.type,
    url: row.url,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}
function mapExercise(row: ExerciseRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: {
      id: row.category_id,
      name: row.category_name,
      description: row.category_description,
    },
    description: row.description,
    instructions: row.instructions,
    equipment: parseJson(row.equipment, []),
    trackingMode: row.tracking_mode,
    difficulty: row.difficulty,
    primaryMuscles: parseJson(row.primary_muscles, []),
    secondaryMuscles: parseJson(row.secondary_muscles, []),
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaCount: row.media_count ?? 0,
  };
}
function getExerciseDetail(request: FastifyRequest, id: string) {
  const row = request.server.db
    .prepare(
      "SELECT exercises.*, exercise_categories.name AS category_name, exercise_categories.description AS category_description, COUNT(exercise_media.id) AS media_count FROM exercises INNER JOIN exercise_categories ON exercise_categories.id = exercises.category_id LEFT JOIN exercise_media ON exercise_media.exercise_id = exercises.id WHERE exercises.id = ? GROUP BY exercises.id",
    )
    .get(id) as ExerciseRow | undefined;
  if (!row) return null;
  const media = request.server.db
    .prepare(
      "SELECT * FROM exercise_media WHERE exercise_id = ? ORDER BY sort_order ASC, id ASC",
    )
    .all(id) as MediaRow[];
  return { ...mapExercise(row), media: media.map(mapMedia) };
}
async function listCategories(request: FastifyRequest) {
  const q = request.query as PaginationQuery;
  const { limit, offset, search } = getPagination(q);
  const params: Array<string | number> = [];
  let where = "";
  if (search) {
    where = "WHERE exercise_categories.name LIKE ? COLLATE NOCASE";
    params.push(`%${search}%`);
  }
  const items = request.server.db
    .prepare(
      `SELECT exercise_categories.id, exercise_categories.name, exercise_categories.description, COUNT(exercises.id) AS exercise_count FROM exercise_categories LEFT JOIN exercises ON exercises.category_id = exercise_categories.id ${where} GROUP BY exercise_categories.id ORDER BY exercise_categories.name ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as CategoryRow[];
  const total = request.server.db
    .prepare(
      `SELECT COUNT(*) AS count FROM exercise_categories ${where.replaceAll("exercise_categories.", "")}`,
    )
    .get(...params) as { count: number };
  return {
    items: items.map(mapCategory),
    pagination: { limit, offset, total: total.count },
  };
}
async function createCategory(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as CategoryBody;
  const id = body.id ?? createId("category");
  try {
    request.server.db
      .prepare(
        "INSERT INTO exercise_categories (id, name, description) VALUES (?, ?, ?)",
      )
      .run(id, body.name, body.description ?? null);
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_CATEGORY_CONFLICT",
      conflictMessage: "Exercise category conflicts with an existing name.",
    });
  }
  return reply.code(201).send({
    id,
    name: body.name,
    description: body.description ?? null,
    exerciseCount: 0,
  });
}
async function getCategoryById(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const row = request.server.db
    .prepare("SELECT * FROM exercise_categories WHERE id = ?")
    .get(params.id) as CategoryRow | undefined;
  return row
    ? mapCategory(row)
    : sendNotFound(
        reply,
        "EXERCISE_CATEGORY_NOT_FOUND",
        "Exercise category not found.",
      );
}
async function updateCategory(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const body = request.body as CategoryBody;
  try {
    const result = request.server.db
      .prepare(
        "UPDATE exercise_categories SET name = ?, description = ? WHERE id = ?",
      )
      .run(body.name, body.description ?? null, params.id);
    if (result.changes === 0)
      return sendNotFound(
        reply,
        "EXERCISE_CATEGORY_NOT_FOUND",
        "Exercise category not found.",
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_CATEGORY_UPDATE_CONFLICT",
      conflictMessage:
        "Exercise category update conflicts with an existing name.",
    });
  }

  const row = request.server.db
    .prepare("SELECT * FROM exercise_categories WHERE id = ?")
    .get(params.id) as CategoryRow | undefined;

  return row
    ? mapCategory(row)
    : sendNotFound(
        reply,
        "EXERCISE_CATEGORY_NOT_FOUND",
        "Exercise category not found.",
      );
}
async function deleteCategory(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  try {
    const result = request.server.db
      .prepare("DELETE FROM exercise_categories WHERE id = ?")
      .run(params.id);
    if (result.changes === 0)
      return sendNotFound(
        reply,
        "EXERCISE_CATEGORY_NOT_FOUND",
        "Exercise category not found.",
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_CATEGORY_DELETE_CONFLICT",
      conflictMessage:
        "Exercise category cannot be deleted while exercises still reference it.",
    });
  }
  return { deleted: true, id: params.id };
}
async function listExercises(request: FastifyRequest) {
  const q = request.query as PaginationQuery;
  const { limit, offset, search } = getPagination(q);
  const params: Array<string | number> = [];
  const conditions: string[] = [];
  if (search) {
    conditions.push(
      "(exercises.name LIKE ? COLLATE NOCASE OR exercises.slug LIKE ? COLLATE NOCASE)",
    );
    params.push(`%${search}%`, `%${search}%`);
  }
  if (q.isActive !== undefined) {
    conditions.push("exercises.is_active = ?");
    params.push(Number(q.isActive));
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const items = request.server.db
    .prepare(
      `SELECT exercises.*, exercise_categories.name AS category_name, exercise_categories.description AS category_description, COUNT(exercise_media.id) AS media_count FROM exercises INNER JOIN exercise_categories ON exercise_categories.id = exercises.category_id LEFT JOIN exercise_media ON exercise_media.exercise_id = exercises.id ${where} GROUP BY exercises.id ORDER BY exercises.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as ExerciseRow[];
  const total = request.server.db
    .prepare(
      `SELECT COUNT(*) AS count FROM exercises ${conditions.length ? `WHERE ${conditions.join(" AND ").replaceAll("exercises.", "")}` : ""}`,
    )
    .get(...params) as { count: number };
  return {
    items: items.map(mapExercise),
    pagination: { limit, offset, total: total.count },
  };
}
async function createExercise(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as ExerciseBody;
  const id = body.id ?? createId("exercise");
  const now = nowIsoString();
  try {
    request.server.db
      .prepare(
        "INSERT INTO exercises (id, slug, name, category_id, description, instructions, equipment, tracking_mode, difficulty, primary_muscles, secondary_muscles, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        body.slug,
        body.name,
        body.categoryId,
        body.description ?? null,
        body.instructions,
        JSON.stringify(body.equipment),
        body.trackingMode,
        body.difficulty,
        JSON.stringify(body.primaryMuscles),
        JSON.stringify(body.secondaryMuscles),
        toSqliteBoolean(body.isActive as boolean | undefined) ?? 1,
        now,
        now,
      );
    if (Array.isArray(body.media)) {
      for (const [index, media] of body.media.entries()) {
        request.server.db
          .prepare(
            "INSERT INTO exercise_media (id, exercise_id, type, url, mime_type, duration_seconds, thumbnail_url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            media.id ?? createId("media"),
            id,
            media.type,
            media.url,
            media.mimeType ?? null,
            media.durationSeconds ?? null,
            media.thumbnailUrl ?? null,
            media.sortOrder ?? index,
            now,
          );
      }
    }
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_CONFLICT",
      conflictMessage: "Exercise conflicts with an existing slug or reference.",
    });
  }
  return reply.code(201).send(getExerciseDetail(request, id));
}
async function getExerciseById(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { exerciseId: string };
  const item = getExerciseDetail(request, params.exerciseId);
  return (
    item ?? sendNotFound(reply, "EXERCISE_NOT_FOUND", "Exercise not found.")
  );
}
async function updateExercise(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { exerciseId: string };
  const body = request.body as ExerciseBody;
  const existing = getExerciseDetail(request, params.exerciseId);
  if (!existing)
    return sendNotFound(reply, "EXERCISE_NOT_FOUND", "Exercise not found.");
  try {
    const next = {
      ...existing,
      ...body,
      categoryId: body.categoryId ?? existing.category.id,
      equipment: body.equipment ?? existing.equipment,
      primaryMuscles: body.primaryMuscles ?? existing.primaryMuscles,
      secondaryMuscles: body.secondaryMuscles ?? existing.secondaryMuscles,
      trackingMode: body.trackingMode ?? existing.trackingMode,
      difficulty: body.difficulty ?? existing.difficulty,
      instructions: body.instructions ?? existing.instructions,
      slug: body.slug ?? existing.slug,
      name: body.name ?? existing.name,
      description:
        body.description === undefined
          ? existing.description
          : body.description,
      isActive: body.isActive ?? existing.isActive,
    };
    request.server.db
      .prepare(
        "UPDATE exercises SET slug = ?, name = ?, category_id = ?, description = ?, instructions = ?, equipment = ?, tracking_mode = ?, difficulty = ?, primary_muscles = ?, secondary_muscles = ?, is_active = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        next.slug,
        next.name,
        next.categoryId,
        next.description ?? null,
        next.instructions,
        JSON.stringify(next.equipment),
        next.trackingMode,
        next.difficulty,
        JSON.stringify(next.primaryMuscles),
        JSON.stringify(next.secondaryMuscles),
        toSqliteBoolean(next.isActive as boolean | undefined) ?? 1,
        nowIsoString(),
        params.exerciseId,
      );
    if (body.media) {
      request.server.db
        .prepare("DELETE FROM exercise_media WHERE exercise_id = ?")
        .run(params.exerciseId);
      for (const [index, media] of body.media.entries()) {
        request.server.db
          .prepare(
            "INSERT INTO exercise_media (id, exercise_id, type, url, mime_type, duration_seconds, thumbnail_url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            media.id ?? createId("media"),
            params.exerciseId,
            media.type,
            media.url,
            media.mimeType ?? null,
            media.durationSeconds ?? null,
            media.thumbnailUrl ?? null,
            media.sortOrder ?? index,
            nowIsoString(),
          );
      }
    }
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_UPDATE_CONFLICT",
      conflictMessage: "Exercise update conflicts with an existing resource.",
    });
  }
  return getExerciseDetail(request, params.exerciseId);
}
async function deleteExercise(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { exerciseId: string };
  try {
    const result = request.server.db
      .prepare("DELETE FROM exercises WHERE id = ?")
      .run(params.exerciseId);
    if (result.changes === 0)
      return sendNotFound(reply, "EXERCISE_NOT_FOUND", "Exercise not found.");
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_DELETE_CONFLICT",
      conflictMessage:
        "Exercise cannot be deleted while it is still referenced.",
    });
  }
  return { deleted: true, id: params.exerciseId };
}
async function createExerciseMedia(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { exerciseId: string };
  const body = request.body as MediaBody;
  const id = createId("media");
  const createdAt = nowIsoString();
  try {
    request.server.db
      .prepare(
        "INSERT INTO exercise_media (id, exercise_id, type, url, mime_type, duration_seconds, thumbnail_url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        params.exerciseId,
        body.type,
        body.url,
        body.mimeType ?? null,
        body.durationSeconds ?? null,
        body.thumbnailUrl ?? null,
        body.sortOrder ?? 0,
        createdAt,
      );
  } catch (error) {
    return handleSqliteError(reply, error, {
      conflictCode: "EXERCISE_MEDIA_CONFLICT",
      conflictMessage: "Exercise media conflicts with an existing resource.",
    });
  }
  const row = request.server.db
    .prepare("SELECT * FROM exercise_media WHERE id = ?")
    .get(id) as MediaRow;
  return reply.code(201).send(mapMedia(row));
}
async function updateExerciseMedia(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { exerciseId: string; mediaId: string };
  const body = request.body as MediaBody;
  const result = request.server.db
    .prepare(
      "UPDATE exercise_media SET type = ?, url = ?, mime_type = ?, duration_seconds = ?, thumbnail_url = ?, sort_order = ? WHERE id = ? AND exercise_id = ?",
    )
    .run(
      body.type,
      body.url,
      body.mimeType ?? null,
      body.durationSeconds ?? null,
      body.thumbnailUrl ?? null,
      body.sortOrder ?? 0,
      params.mediaId,
      params.exerciseId,
    );
  if (result.changes === 0)
    return sendNotFound(
      reply,
      "EXERCISE_MEDIA_NOT_FOUND",
      "Exercise media not found.",
    );
  const row = request.server.db
    .prepare("SELECT * FROM exercise_media WHERE id = ?")
    .get(params.mediaId) as MediaRow;
  return mapMedia(row);
}
async function deleteExerciseMedia(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = request.params as { exerciseId: string; mediaId: string };
  const result = request.server.db
    .prepare("DELETE FROM exercise_media WHERE id = ? AND exercise_id = ?")
    .run(params.mediaId, params.exerciseId);
  if (result.changes === 0)
    return sendNotFound(
      reply,
      "EXERCISE_MEDIA_NOT_FOUND",
      "Exercise media not found.",
    );
  return { deleted: true, id: params.mediaId };
}
export function adminCatalogRoutes({
  apiBasePath,
}: AdminRouteOptions): AppRouteDefinition[] {
  const auth = requireAdminAuth();
  return [
    {
      method: "GET",
      operationId: "listExerciseCategories",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: buildListResponseSchema(categorySchema),
        401: errorResponseSchema,
      },
      summary: "List exercise categories.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/categories`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "List exercise categories.",
        querystring: paginationQuerySchema,
        response: {
          200: buildListResponseSchema(categorySchema),
          401: errorResponseSchema,
        },
      }),
      handler: listCategories,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createExerciseCategory",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: categorySchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create an exercise category.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/categories`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Create an exercise category.",
        body: categoryBodySchema,
        response: {
          201: categorySchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createCategory,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "getExerciseCategory",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: categorySchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get an exercise category.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/categories/:id`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Get an exercise category.",
        params: idParamSchema,
        response: {
          200: categorySchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getCategoryById,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateExerciseCategory",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: categorySchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Update an exercise category.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/categories/:id`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Update an exercise category.",
        params: idParamSchema,
        body: categoryBodySchema,
        response: {
          200: categorySchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: updateCategory,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteExerciseCategory",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: deleteSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Delete an exercise category.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/categories/:id`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Delete an exercise category.",
        params: idParamSchema,
        response: {
          200: deleteSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: deleteCategory,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "listExercises",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: buildListResponseSchema(exerciseSchema),
        401: errorResponseSchema,
      },
      summary: "List exercises with category context.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "List exercises with category context.",
        querystring: paginationQuerySchema,
        response: {
          200: buildListResponseSchema(exerciseSchema),
          401: errorResponseSchema,
        },
      }),
      handler: listExercises,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: exerciseDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Create an exercise.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Create an exercise.",
        body: exerciseBodySchema,
        response: {
          201: exerciseDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: createExercise,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "GET",
      operationId: "getExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: exerciseDetailSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get one exercise with attached media.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Get one exercise with attached media.",
        params: exerciseIdParamsSchema,
        response: {
          200: exerciseDetailSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: getExerciseById,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: exerciseDetailSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Update one exercise.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Update one exercise.",
        params: exerciseIdParamsSchema,
        body: exerciseBodySchema,
        response: {
          200: exerciseDetailSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: updateExercise,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteExercise",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: deleteSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Delete one exercise.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Delete one exercise.",
        params: exerciseIdParamsSchema,
        response: {
          200: deleteSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
      handler: deleteExercise,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "POST",
      operationId: "createExerciseMedia",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        201: mediaSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Attach media to an exercise.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId/media`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Attach media to an exercise.",
        params: exerciseIdParamsSchema,
        body: mediaBodySchema,
        response: {
          201: mediaSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: createExerciseMedia,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "PATCH",
      operationId: "updateExerciseMedia",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: mediaSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Update attached exercise media.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId/media/:mediaId`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Update attached exercise media.",
        params: mediaParamsSchema,
        body: mediaBodySchema,
        response: {
          200: mediaSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: updateExerciseMedia,
      security: [{ bearerAuth: [] }],
    },
    {
      method: "DELETE",
      operationId: "deleteExerciseMedia",
      preHandler: auth,
      responseContentType: "application/json",
      response: {
        200: deleteSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Delete attached exercise media.",
      tags: ["admin-catalog"],
      url: `${apiBasePath}/admin/exercises/:exerciseId/media/:mediaId`,
      schema: buildRouteSchema({
        tags: ["admin-catalog"],
        summary: "Delete attached exercise media.",
        params: mediaParamsSchema,
        response: {
          200: deleteSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
      handler: deleteExerciseMedia,
      security: [{ bearerAuth: [] }],
    },
  ];
}
