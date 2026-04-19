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

test("GET /health reports a reachable database", async () => {
  const context = createTestEnv();
  const app = buildApp({
    env: context.env,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();

    assert.equal(payload.status, "ok");
    assert.equal(payload.database.reachable, true);
    assert.equal(payload.database.migrationCount, 1);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("GET /openapi.json exposes the protected admin foundation route", async () => {
  const context = createTestEnv();
  const app = buildApp({
    env: context.env,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();

    assert.ok(payload.paths["/health"]);
    assert.ok(payload.paths["/api/v1/admin/session"]);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("GET /api/v1/admin/session requires a valid seeded bearer token", async () => {
  const context = createTestEnv();
  const app = buildApp({
    env: context.env,
  });

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
      headers: {
        authorization: `Bearer ${context.env.ADMIN_SEED_TOKEN}`,
      },
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
