import assert from "node:assert/strict";
import {
  type KeyObject,
  createHash,
  createSign,
  generateKeyPairSync,
} from "node:crypto";
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
    assert.equal(payload.database.migrationCount, 5);
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
    assert.ok(payload.paths["/api/v1/auth/passkey/register/options"]);
    assert.ok(payload.paths["/api/v1/auth/passkey/login/options"]);
    assert.ok(payload.paths["/api/v1/auth/me"]);
    assert.ok(payload.paths["/api/v1/me/workouts"]);
    assert.ok(payload.paths["/api/v1/me/workouts/today"]);
    assert.ok(payload.paths["/api/v1/me/workout-sessions"]);
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
    assert.equal(sessionsPayload.items[0].sets.length > 0, true);
    assert.equal(
      sessionsPayload.items[0].feedback.id,
      "feedback_foundation_a_2026_01_10",
    );
    assert.equal(sessionsPayload.items[0].feedback.difficultyRating, 7);

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

function parseSessionCookie(setCookieHeader: string[] | string | undefined) {
  if (!setCookieHeader) return null;
  const header = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  for (const value of header) {
    const match = /fitracker_session=([^;]+)/.exec(value);
    if (match?.[1]) return match[1];
  }
  return null;
}

function encodeClientDataJSON(payload: {
  challenge: string;
  origin: string;
  type: "webauthn.create" | "webauthn.get";
}) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function buildAuthenticatorData(rpId: string, counter: number) {
  const rpIdHash = createHash("sha256").update(rpId).digest();
  const flags = Buffer.from([0x05]);
  const counterBuffer = Buffer.alloc(4);
  counterBuffer.writeUInt32BE(counter, 0);
  return Buffer.concat([rpIdHash, flags, counterBuffer]);
}

function signAssertion(
  privateKey: KeyObject,
  authenticatorData: Buffer,
  clientDataJSON: string,
) {
  const clientDataHash = createHash("sha256")
    .update(Buffer.from(clientDataJSON, "base64url"))
    .digest();
  const signer = createSign("sha256");
  signer.update(Buffer.concat([authenticatorData, clientDataHash]));
  signer.end();
  return signer.sign(privateKey);
}

function createTestAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const spki = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey,
    publicKeyBase64Url: Buffer.from(spki).toString("base64url"),
  };
}

test("user session, workouts, sets, completion, and feedback flow", async () => {
  const context = createTestEnv();
  const testEnv = loadEnv({
    DATABASE_PATH: context.env.DATABASE_PATH,
    NODE_ENV: "test",
    ADMIN_SEED_TOKEN: context.env.ADMIN_SEED_TOKEN,
    ADMIN_SEED_TOKEN_NAME: context.env.ADMIN_SEED_TOKEN_NAME,
    WEBAUTHN_ORIGIN: "http://localhost:3000",
    WEBAUTHN_RP_ID: "localhost",
    WEBAUTHN_RP_NAME: "Fitracker Test",
  });
  const app = buildApp({ env: testEnv });
  seedDatabase(app.db, testEnv);
  const authenticator = createTestAuthenticator();
  const origin = "http://localhost:3000";
  const rpId = "localhost";
  const credentialId = "cred_test_primary";

  try {
    const unauthed = await app.inject({
      method: "GET",
      url: "/api/v1/me/workouts",
    });
    assert.equal(unauthed.statusCode, 401);

    const registerOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/options",
      headers: { origin, host: "localhost:3000" },
      payload: { userId: "user_arnau", displayName: "Arnau" },
    });
    assert.equal(registerOptions.statusCode, 200);
    const optionsPayload = registerOptions.json();

    const registerVerify = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/register/verify",
      headers: { origin, host: "localhost:3000" },
      payload: {
        challengeId: optionsPayload.challengeId,
        credentialId,
        clientDataJSON: encodeClientDataJSON({
          type: "webauthn.create",
          challenge: optionsPayload.publicKey.challenge,
          origin,
        }),
        publicKey: authenticator.publicKeyBase64Url,
        transports: ["internal"],
      },
    });
    assert.equal(registerVerify.statusCode, 200);
    const sessionCookie = parseSessionCookie(
      registerVerify.headers["set-cookie"] as string[] | string | undefined,
    );
    assert.ok(sessionCookie);

    const headers = {
      cookie: `fitracker_session=${sessionCookie}`,
    };

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers,
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().authenticated, true);
    assert.equal(me.json().user.id, "user_arnau");

    const workouts = await app.inject({
      method: "GET",
      url: "/api/v1/me/workouts",
      headers,
    });
    assert.equal(workouts.statusCode, 200);
    const workoutsPayload = workouts.json();
    assert.ok(workoutsPayload.items.length >= 1);
    const firstTemplateId = workoutsPayload.items[0].workoutTemplate.id;

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/me/workouts/${firstTemplateId}`,
      headers,
    });
    assert.equal(detail.statusCode, 200);
    assert.ok(detail.json().exercises.length > 0);

    const exercises = await app.inject({
      method: "GET",
      url: "/api/v1/me/exercises",
      headers,
    });
    assert.equal(exercises.statusCode, 200);
    assert.ok(exercises.json().items.length > 0);

    const session = await app.inject({
      method: "POST",
      url: "/api/v1/me/workout-sessions",
      headers,
      payload: {
        workoutTemplateId: firstTemplateId,
        assignmentId: workoutsPayload.items[0].id,
        notes: "Starting now",
      },
    });
    assert.equal(session.statusCode, 201);
    const sessionPayload = session.json();
    assert.equal(sessionPayload.status, "in_progress");

    const firstSet = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionPayload.id}/sets`,
      headers,
      payload: {
        exerciseId: "exercise_goblet_squat",
        sequence: 2,
        setNumber: 1,
        performedReps: 10,
        performedWeight: 18,
        performedWeightUnit: "kg",
        rpe: 7,
        completed: true,
      },
    });
    assert.equal(firstSet.statusCode, 201);
    const setPayload = firstSet.json();

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionPayload.id}/sets`,
      headers,
      payload: {
        exerciseId: "exercise_goblet_squat",
        sequence: 2,
        setNumber: 1,
        performedReps: 8,
      },
    });
    assert.equal(duplicate.statusCode, 400);

    const updatedSet = await app.inject({
      method: "PATCH",
      url: `/api/v1/me/workout-sessions/${sessionPayload.id}/sets/${setPayload.id}`,
      headers,
      payload: { performedReps: 11, rpe: 8, notes: "Top set felt strong" },
    });
    assert.equal(updatedSet.statusCode, 200);
    assert.equal(updatedSet.json().performedReps, 11);

    const completed = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionPayload.id}/complete`,
      headers,
      payload: { durationSeconds: 2400 },
    });
    assert.equal(completed.statusCode, 200);
    assert.equal(completed.json().status, "completed");

    const feedback = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionPayload.id}/feedback`,
      headers,
      payload: {
        mood: "energized",
        difficultyRating: 7,
        energyRating: 4,
        painFlag: false,
        freeText: "Legs felt stable throughout.",
      },
    });
    assert.equal(feedback.statusCode, 200);
    assert.equal(feedback.json().difficultyRating, 7);

    const loginOptions = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/options",
      headers: { origin, host: "localhost:3000" },
      payload: { userId: "user_arnau" },
    });
    assert.equal(loginOptions.statusCode, 200);
    const loginOptionsPayload = loginOptions.json();
    const authenticatorData = buildAuthenticatorData(rpId, 1);
    const loginClientData = encodeClientDataJSON({
      type: "webauthn.get",
      challenge: loginOptionsPayload.publicKey.challenge,
      origin,
    });
    const signature = signAssertion(
      authenticator.privateKey,
      authenticatorData,
      loginClientData,
    );

    const loginVerify = await app.inject({
      method: "POST",
      url: "/api/v1/auth/passkey/login/verify",
      headers: { origin, host: "localhost:3000" },
      payload: {
        challengeId: loginOptionsPayload.challengeId,
        credentialId,
        authenticatorData: authenticatorData.toString("base64url"),
        clientDataJSON: loginClientData,
        signature: signature.toString("base64url"),
      },
    });
    assert.equal(loginVerify.statusCode, 200);
    assert.equal(loginVerify.json().authenticated, true);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers,
    });
    assert.equal(logout.statusCode, 200);
    assert.equal(logout.json().authenticated, false);
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
