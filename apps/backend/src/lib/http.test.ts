import assert from "node:assert/strict";
import test from "node:test";

import {
  appendSetCookieHeader,
  parseCookies,
  serializeCookie,
} from "./http.js";

type ReplyStub = {
  header: (name: string, value: unknown) => ReplyStub;
  headers: Record<string, unknown>;
  getHeader: (name: string) => unknown;
};

function createReplyStub(
  initialHeaders: Record<string, unknown> = {},
): ReplyStub {
  return {
    header(name, value) {
      this.headers[name] = value;
      return this;
    },
    headers: { ...initialHeaders },
    getHeader(name) {
      return this.headers[name];
    },
  };
}

test("parseCookies handles empty values and decodes cookie payloads", () => {
  assert.deepEqual(parseCookies(), {});
  assert.deepEqual(parseCookies("fitracker_session=abc123; theme=dark"), {
    fitracker_session: "abc123",
    theme: "dark",
  });
  assert.deepEqual(parseCookies("note=legs%20felt%20good; broken"), {
    broken: "",
    note: "legs felt good",
  });
});

test("serializeCookie uses secure defaults and supports overrides", () => {
  assert.equal(
    serializeCookie("fitracker_session", "abc 123"),
    "fitracker_session=abc%20123; Path=/; HttpOnly; SameSite=Lax",
  );
  assert.equal(
    serializeCookie("fitracker_session", "abc123", {
      expires: new Date("2026-04-20T09:00:00.000Z"),
      httpOnly: false,
      maxAge: 120,
      path: "/api",
      sameSite: "Strict",
      secure: true,
    }),
    "fitracker_session=abc123; Path=/api; SameSite=Strict; Secure; Max-Age=120; Expires=Mon, 20 Apr 2026 09:00:00 GMT",
  );
});

test("appendSetCookieHeader preserves existing cookie headers", () => {
  const emptyReply = createReplyStub();
  appendSetCookieHeader(emptyReply as never, "first=1");
  assert.equal(emptyReply.headers["set-cookie"], "first=1");

  const stringReply = createReplyStub({
    "set-cookie": "first=1",
  });
  appendSetCookieHeader(stringReply as never, "second=2");
  assert.deepEqual(stringReply.headers["set-cookie"], ["first=1", "second=2"]);

  const arrayReply = createReplyStub({
    "set-cookie": ["first=1"],
  });
  appendSetCookieHeader(arrayReply as never, "second=2");
  assert.deepEqual(arrayReply.headers["set-cookie"], ["first=1", "second=2"]);
});
