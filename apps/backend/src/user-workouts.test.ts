import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "./app.js";
import { seedDatabase } from "./db/seeds.js";
import {
  createTestEnv,
  createWebAuthnTestEnv,
  registerPasskeySession,
} from "./test-helpers.js";

test("user workout routes reject invalid assignment ids and missing session resources", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const registration = await registerPasskeySession(app, {
      credentialId: "cred_test_user_routes",
    });
    assert.ok(registration.sessionCookie);
    const headers = {
      cookie: `fitracker_session=${registration.sessionCookie}`,
    };

    const invalidAssignment = await app.inject({
      method: "POST",
      url: "/api/v1/me/workout-sessions",
      headers,
      payload: {
        assignmentId: "assignment_missing",
        workoutTemplateId: "template_foundation_a",
      },
    });

    assert.equal(invalidAssignment.statusCode, 400);
    assert.equal(
      invalidAssignment.json().code,
      "WORKOUT_SESSION_ASSIGNMENT_INVALID",
    );

    const missingSession = await app.inject({
      method: "GET",
      url: "/api/v1/me/workout-sessions/session_missing",
      headers,
    });

    assert.equal(missingSession.statusCode, 404);
    assert.equal(missingSession.json().code, "WORKOUT_SESSION_NOT_FOUND");

    const createdSession = await app.inject({
      method: "POST",
      url: "/api/v1/me/workout-sessions",
      headers,
      payload: {
        workoutTemplateId: "template_foundation_a",
      },
    });

    assert.equal(createdSession.statusCode, 201);
    const sessionId = createdSession.json().id;

    const missingSet = await app.inject({
      method: "PATCH",
      url: `/api/v1/me/workout-sessions/${sessionId}/sets/set_missing`,
      headers,
      payload: {},
    });

    assert.equal(missingSet.statusCode, 404);
    assert.equal(missingSet.json().code, "WORKOUT_SESSION_SET_NOT_FOUND");

    const missingFeedback = await app.inject({
      method: "POST",
      url: "/api/v1/me/workout-sessions/session_missing/feedback",
      headers,
      payload: {
        painFlag: false,
      },
    });

    assert.equal(missingFeedback.statusCode, 404);
    assert.equal(missingFeedback.json().code, "WORKOUT_SESSION_NOT_FOUND");
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("user workout routes support today filters, pagination, updates, and feedback replacement", async () => {
  const context = createTestEnv();
  const env = createWebAuthnTestEnv(context.env);
  const app = buildApp({ env });
  seedDatabase(app.db, env);

  try {
    const registration = await registerPasskeySession(app, {
      credentialId: "cred_test_updates",
    });
    assert.ok(registration.sessionCookie);
    const headers = {
      cookie: `fitracker_session=${registration.sessionCookie}`,
    };

    const today = await app.inject({
      method: "GET",
      url: "/api/v1/me/workouts/today?date=2026-01-10",
      headers,
    });
    assert.equal(today.statusCode, 200);
    assert.ok(today.json().items.length >= 1);

    const pagedSessions = await app.inject({
      method: "GET",
      url: "/api/v1/me/workout-sessions?limit=1&offset=1",
      headers,
    });
    assert.equal(pagedSessions.statusCode, 200);
    assert.equal(pagedSessions.json().limit, 1);
    assert.equal(pagedSessions.json().offset, 1);
    assert.equal(pagedSessions.json().items.length, 1);

    const createdSession = await app.inject({
      method: "POST",
      url: "/api/v1/me/workout-sessions",
      headers,
      payload: {
        workoutTemplateId: "template_foundation_a",
      },
    });
    assert.equal(createdSession.statusCode, 201);
    const sessionId = createdSession.json().id as string;

    const updatedSession = await app.inject({
      method: "PATCH",
      url: `/api/v1/me/workout-sessions/${sessionId}`,
      headers,
      payload: {
        notes: "Keep the pace up.",
        startedAt: "2026-04-20T09:10:00.000Z",
      },
    });
    assert.equal(updatedSession.statusCode, 200);
    assert.equal(updatedSession.json().notes, "Keep the pace up.");

    const noOpSet = await app.inject({
      method: "PATCH",
      url: `/api/v1/me/workout-sessions/${sessionId}/sets/set_missing`,
      headers,
      payload: {},
    });
    assert.equal(noOpSet.statusCode, 404);

    const createdSet = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionId}/sets`,
      headers,
      payload: {
        exerciseId: "exercise_goblet_squat",
        sequence: 1,
        setNumber: 1,
      },
    });
    assert.equal(createdSet.statusCode, 201);

    const updatedSet = await app.inject({
      method: "PATCH",
      url: `/api/v1/me/workout-sessions/${sessionId}/sets/${createdSet.json().id}`,
      headers,
      payload: {
        notes: "Smooth top set",
        performedReps: 12,
      },
    });
    assert.equal(updatedSet.statusCode, 200);
    assert.equal(updatedSet.json().performedReps, 12);

    const firstFeedback = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionId}/feedback`,
      headers,
      payload: {
        freeText: "First note",
        painFlag: false,
      },
    });
    const secondFeedback = await app.inject({
      method: "POST",
      url: `/api/v1/me/workout-sessions/${sessionId}/feedback`,
      headers,
      payload: {
        freeText: "Updated note",
        painFlag: true,
        painNotes: "Left shoulder",
      },
    });

    assert.equal(firstFeedback.statusCode, 200);
    assert.equal(secondFeedback.statusCode, 200);
    assert.equal(secondFeedback.json().freeText, "Updated note");
    assert.equal(secondFeedback.json().painFlag, true);
    assert.equal(secondFeedback.json().painNotes, "Left shoulder");
  } finally {
    await app.close();
    context.cleanup();
  }
});
