import assert from "node:assert/strict";
import test from "node:test";

import { createTestEnv } from "../test-helpers.js";
import {
  readMcpAdminToken,
  resolveMcpAdminTokenFilePath,
  writeMcpAdminToken,
} from "./mcp-admin-auth.js";

test("readMcpAdminToken prefers MCP_ADMIN_TOKEN from env", () => {
  const context = createTestEnv();

  try {
    const env = {
      ...context.env,
      MCP_ADMIN_TOKEN: "mcp-admin-token-from-env",
    };

    writeMcpAdminToken(env, "mcp-admin-token-from-file");

    assert.equal(readMcpAdminToken(env), "mcp-admin-token-from-env");
  } finally {
    context.cleanup();
  }
});

test("writeMcpAdminToken persists the token next to the database by default", () => {
  const context = createTestEnv();

  try {
    const tokenPath = writeMcpAdminToken(
      context.env,
      "mcp-admin-token-from-file",
    );

    assert.equal(tokenPath, resolveMcpAdminTokenFilePath(context.env));
    assert.equal(readMcpAdminToken(context.env), "mcp-admin-token-from-file");
  } finally {
    context.cleanup();
  }
});
