import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildApp } from "./app.js";
import { seedDatabase } from "./db/seeds.js";
import { loadEnv } from "./env.js";

function createTestEnv() {
  const directory = mkdtempSync(join(tmpdir(), "fitracker-backend-"));
  const env = loadEnv({
    DATABASE_PATH: join(directory, "test.db"),
    NODE_ENV: "test",
    ADMIN_SEED_TOKEN: "fitracker-local-admin-token-for-tests",
    ADMIN_SEED_TOKEN_NAME: "Test Coach Token",
  });

  return {
    cleanup() {
      rmSync(directory, {
        force: true,
        recursive: true,
      });
    },
    env,
  };
}

function adminHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

test("GET /health reports a reachable database", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();

    assert.equal(payload.status, "ok");
    assert.equal(payload.database.reachable, true);
    assert.equal(payload.database.migrationCount, 3);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("GET /openapi.json exposes phase 3 admin endpoints", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();

    assert.ok(payload.paths["/api/v1/admin/session"]);
    assert.ok(payload.paths["/api/v1/admin/categories"]);
    assert.ok(payload.paths["/api/v1/admin/exercises"]);
    assert.ok(payload.paths["/api/v1/admin/workout-templates"]);
    assert.ok(payload.paths["/api/v1/admin/assignments"]);
    assert.ok(payload.paths["/api/v1/admin/reporting/sessions"]);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("GET /api/v1/admin/session requires a valid seeded bearer token", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  seedDatabase(app.db, context.env);

  try {
    const unauthorized = await app.inject({
      method: "GET",
      url: "/api/v1/admin/session",
    });

    assert.equal(unauthorized.statusCode, 401);

    const authorized = await app.inject({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(authorized.statusCode, 200);

    const payload = authorized.json();

    assert.equal(payload.authenticated, true);
    assert.equal(payload.token.name, context.env.ADMIN_SEED_TOKEN_NAME);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("admin catalog CRUD supports categories, exercises, and media", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const createCategory = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        name: "Recovery",
        description: "Range of motion work.",
      },
    });

    assert.equal(createCategory.statusCode, 201);
    const categoryPayload = createCategory.json();
    assert.equal(categoryPayload.name, "Recovery");

    const createExercise = await app.inject({
      method: "POST",
      url: "/api/v1/admin/exercises",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        slug: "box-breathing",
        name: "Box Breathing",
        categoryId: categoryPayload.id,
        description: "Simple breathing drill.",
        instructions: "Breathe in, hold, out, hold.",
        trackingMode: "time",
        difficulty: "beginner",
        equipment: [],
        primaryMuscles: ["diaphragm"],
        secondaryMuscles: [],
      },
    });

    assert.equal(createExercise.statusCode, 201);
    const exercisePayload = createExercise.json();
    assert.equal(exercisePayload.category.name, "Recovery");

    const createMedia = await app.inject({
      method: "POST",
      url: `/api/v1/admin/exercises/${exercisePayload.id}/media`,
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        type: "video",
        url: "/media/exercises/box-breathing/demo.mp4",
        durationSeconds: 30,
        thumbnailUrl: "/media/exercises/box-breathing/demo.png",
        sortOrder: 0,
      },
    });

    assert.equal(createMedia.statusCode, 201);

    const listCategories = await app.inject({
      method: "GET",
      url: "/api/v1/admin/categories",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(listCategories.statusCode, 200);
    assert.ok(
      listCategories
        .json()
        .items.some(
          (category: { id: string }) => category.id === categoryPayload.id,
        ),
    );

    const updateExercise = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/exercises/${exercisePayload.id}`,
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        slug: "box-breathing-reset",
        name: "Box Breathing Reset",
        categoryId: categoryPayload.id,
        description: "Simple breathing drill.",
        instructions: "Breathe in, hold, out, hold.",
        trackingMode: "time",
        difficulty: "beginner",
        equipment: [],
        primaryMuscles: ["diaphragm"],
        secondaryMuscles: [],
        isActive: true,
      },
    });

    assert.equal(updateExercise.statusCode, 200);
    assert.equal(updateExercise.json().name, "Box Breathing Reset");

    const getExercise = await app.inject({
      method: "GET",
      url: `/api/v1/admin/exercises/${exercisePayload.id}`,
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(getExercise.statusCode, 200);
    assert.equal(getExercise.json().media.length, 1);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("admin workout templates and assignments CRUD are usable", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const createTemplate = await app.inject({
      method: "POST",
      url: "/api/v1/admin/workout-templates",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        slug: "upper-reset",
        name: "Upper Reset",
        goal: "Light upper body primer",
        estimatedDurationMin: 22,
        difficulty: "beginner",
      },
    });

    assert.equal(createTemplate.statusCode, 201);
    const templatePayload = createTemplate.json();

    const addTemplateExercise = await app.inject({
      method: "POST",
      url: `/api/v1/admin/workout-templates/${templatePayload.id}/exercises`,
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        exerciseId: "exercise_split_stance_row",
        sequence: 1,
        blockLabel: "main",
        targetSets: 3,
        targetRepsMin: 10,
        targetRepsMax: 12,
        restSeconds: 60,
      },
    });

    assert.equal(addTemplateExercise.statusCode, 201);
    assert.equal(addTemplateExercise.json().exercises.length, 1);

    const createAssignment = await app.inject({
      method: "POST",
      url: "/api/v1/admin/assignments",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        userId: "user_arnau",
        workoutTemplateId: templatePayload.id,
        assignedBy: "coach-fitnaista",
        startsOn: "2026-03-02",
        frequencyPerWeek: 2,
        isActive: true,
      },
    });

    assert.equal(createAssignment.statusCode, 201);
    const assignmentPayload = createAssignment.json();
    assert.equal(assignmentPayload.workoutTemplate.slug, "upper-reset");

    const updateAssignment = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/assignments/${assignmentPayload.id}`,
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        userId: "user_arnau",
        workoutTemplateId: templatePayload.id,
        assignedBy: "coach-fitnaista",
        startsOn: "2026-03-02",
        frequencyPerWeek: 1,
        isActive: false,
        scheduleNotes: "Use during deload weeks.",
      },
    });

    assert.equal(updateAssignment.statusCode, 200);
    assert.equal(updateAssignment.json().isActive, false);

    const listAssignments = await app.inject({
      method: "GET",
      url: "/api/v1/admin/assignments?userId=user_arnau",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(listAssignments.statusCode, 200);
    assert.ok(
      listAssignments
        .json()
        .items.some(
          (assignment: { id: string }) =>
            assignment.id === assignmentPayload.id,
        ),
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("admin reporting exposes nested sessions, set logs, feedback, and summary", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const sessionsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reporting/sessions?userId=user_arnau&status=completed",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(sessionsResponse.statusCode, 200);
    const sessionsPayload = sessionsResponse.json();
    assert.equal(sessionsPayload.summary.completedSessions, 1);
    assert.equal(sessionsPayload.items[0].setLogs.length > 0, true);
    assert.equal(
      sessionsPayload.items[0].feedback.id,
      "feedback_foundation_a_2026_01_10",
    );

    const feedbackResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reporting/feedback",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(feedbackResponse.statusCode, 200);
    assert.equal(feedbackResponse.json().items.length, 1);

    const singleSession = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reporting/sessions/session_foundation_a_2026_01_10",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
    });

    assert.equal(singleSession.statusCode, 200);
    assert.equal(
      singleSession.json().workoutTemplate.name,
      "Foundation Session A",
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("admin validation returns a 400 payload for invalid requests", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: adminHeaders(context.env.ADMIN_SEED_TOKEN),
      payload: {
        description: "Missing name should fail.",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "VALIDATION_ERROR");
  } finally {
    await app.close();
    context.cleanup();
  }
});
