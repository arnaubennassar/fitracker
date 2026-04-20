import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../app.js";
import { seedDatabase } from "../db/seeds.js";
import { createTestEnv, parseSessionCookie } from "../test-helpers.js";
import {
  clearUserSessionCookie,
  createUserSession,
  getRpId,
  getRpName,
  getSessionOrigin,
  resolveUserSession,
  revokeUserSession,
} from "./user-session.js";

function createReplyStub(initialHeaders: Record<string, unknown> = {}) {
  return {
    header(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    headers: { ...initialHeaders },
    getHeader(name: string) {
      return this.headers[name];
    },
  };
}

type RequestStub = {
  headers: {
    cookie?: string;
    host?: string;
    origin?: string;
    "x-forwarded-host"?: string;
    "x-forwarded-proto"?: string;
  };
  server: ReturnType<typeof buildApp>;
};

test("session origin and RP metadata use the documented precedence", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    assert.equal(
      getSessionOrigin({
        headers: {
          host: "localhost:3000",
        },
        server: app,
      } as never),
      "http://localhost:3000",
    );

    assert.equal(
      getSessionOrigin({
        headers: {
          host: "localhost:3000",
          origin: "http://127.0.0.1:3000",
        },
        server: app,
      } as never),
      "http://127.0.0.1:3000",
    );

    assert.equal(
      getSessionOrigin({
        headers: {
          "x-forwarded-host": "fitracker.example.com",
          "x-forwarded-proto": "https",
        },
        server: app,
      } as never),
      "https://fitracker.example.com",
    );

    assert.equal(
      getRpId({
        headers: {
          host: "localhost:3000",
        },
        server: app,
      } as never),
      "localhost",
    );
    assert.equal(
      getRpName({
        headers: {},
        server: app,
      } as never),
      context.env.APP_NAME,
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("createUserSession resolves, refreshes, and revokes cookie-backed sessions", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const request: RequestStub = {
      headers: {
        host: "localhost:3000",
      },
      server: app,
    };
    const reply = createReplyStub();
    const created = createUserSession(request as never, reply as never);
    const sessionCookie = parseSessionCookie(
      reply.headers["set-cookie"] as string,
    );

    assert.ok(sessionCookie);
    assert.ok(created.id.startsWith("athletesession_"));

    request.headers.cookie = `fitracker_session=${sessionCookie}`;
    const session = resolveUserSession(request as never);

    assert.ok(session);
    assert.equal(session?.id, created.id);

    app.db
      .prepare(
        `
          UPDATE athlete_sessions
          SET last_seen_at = '2026-04-20T08:00:00.000Z'
          WHERE id = ?
        `,
      )
      .run(created.id);

    const refreshed = resolveUserSession(request as never);
    assert.ok(refreshed);
    assert.notEqual(refreshed?.lastSeenAt, "2026-04-20T08:00:00.000Z");

    revokeUserSession(request as never, reply as never, created.id);
    assert.match(String(reply.headers["set-cookie"]), /Max-Age=0/);
    assert.equal(resolveUserSession(request as never), null);
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("resolveUserSession rejects expired sessions and clearUserSessionCookie expires the cookie", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });
  seedDatabase(app.db, context.env);

  try {
    const request: RequestStub = {
      headers: {
        host: "localhost:3000",
      },
      server: app,
    };
    const reply = createReplyStub();
    const created = createUserSession(request as never, reply as never);
    const sessionCookie = parseSessionCookie(
      reply.headers["set-cookie"] as string,
    );

    assert.ok(sessionCookie);
    request.headers.cookie = `fitracker_session=${sessionCookie}`;

    app.db
      .prepare(
        `
          UPDATE athlete_sessions
          SET expires_at = '2026-04-19T09:00:00.000Z'
          WHERE id = ?
        `,
      )
      .run(created.id);
    assert.equal(resolveUserSession(request as never), null);

    clearUserSessionCookie(request as never, reply as never);
    assert.match(
      String(reply.headers["set-cookie"]),
      /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
    );
  } finally {
    await app.close();
    context.cleanup();
  }
});
