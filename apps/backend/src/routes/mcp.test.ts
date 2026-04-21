import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { buildApp } from "../app.js";
import { seedDatabase } from "../db/seeds.js";
import { createTestEnv } from "../test-helpers.js";

type McpClientContext = {
  client: Client;
  transport: StreamableHTTPClientTransport;
};

async function startMcpClient(
  app: ReturnType<typeof buildApp>,
): Promise<McpClientContext> {
  const address = await app.listen({
    host: "127.0.0.1",
    port: 0,
  });
  const client = new Client({
    name: "fitracker-backend-test-client",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp", address.endsWith("/") ? address : `${address}/`),
  );

  await client.connect(transport as never);

  return {
    client,
    transport,
  };
}

function extractStructuredContent(result: unknown) {
  const toolResult =
    typeof result === "object" &&
    result !== null &&
    "toolResult" in result &&
    typeof (result as { toolResult?: unknown }).toolResult === "object"
      ? (result as { toolResult: { structuredContent?: unknown } }).toolResult
      : (result as { structuredContent?: unknown });

  assert.ok(
    toolResult.structuredContent &&
      typeof toolResult.structuredContent === "object" &&
      !Array.isArray(toolResult.structuredContent),
  );

  return toolResult.structuredContent as {
    data?: unknown;
    error?: unknown;
    ok: boolean;
    statusCode: number;
  };
}

test("MCP exposes only admin operationIds as tools", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    seedDatabase(app.db, context.env);
    const { client, transport } = await startMcpClient(app);
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((tool) => tool.name).sort();
    const expectedNames = app.routeIndex
      .filter((route) =>
        route.url.startsWith(`${context.env.API_BASE_PATH}/admin`),
      )
      .map((route) => route.operationId)
      .sort();

    assert.deepEqual(toolNames, expectedNames);
    assert.ok(!toolNames.includes("listMyWorkoutSessions"));
    assert.ok(!toolNames.includes("getHealth"));

    await client.close();
    await transport.close();
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("MCP category tools support query, params, body, and delete flows", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    seedDatabase(app.db, context.env);
    const { client, transport } = await startMcpClient(app);

    const createResult = await client.callTool({
      name: "createExerciseCategory",
      arguments: {
        body: {
          description: "Mobility and prep work",
          name: "Warmup",
        },
      },
    });
    const created = extractStructuredContent(createResult);
    assert.equal(created.ok, true);
    assert.equal(created.statusCode, 201);
    assert.equal((created.data as { name: string }).name, "Warmup");

    const categoryId = (created.data as { id: string }).id;

    const listResult = await client.callTool({
      name: "listExerciseCategories",
      arguments: {
        query: {
          limit: 1,
          offset: 0,
          search: "Warmup",
        },
      },
    });
    const listed = extractStructuredContent(listResult);
    assert.equal(listed.ok, true);
    assert.equal(listed.statusCode, 200);
    assert.equal(
      (listed.data as { items: Array<{ id: string }> }).items[0]?.id,
      categoryId,
    );

    const getResult = await client.callTool({
      name: "getExerciseCategory",
      arguments: {
        params: {
          id: categoryId,
        },
      },
    });
    const fetched = extractStructuredContent(getResult);
    assert.equal(fetched.ok, true);
    assert.equal(fetched.statusCode, 200);
    assert.equal((fetched.data as { id: string; name: string }).id, categoryId);

    const updateResult = await client.callTool({
      name: "updateExerciseCategory",
      arguments: {
        body: {
          description: "Prep and activation work",
          name: "Warm Up",
        },
        params: {
          id: categoryId,
        },
      },
    });
    const updated = extractStructuredContent(updateResult);
    assert.equal(updated.ok, true);
    assert.equal(updated.statusCode, 200);
    assert.equal((updated.data as { name: string }).name, "Warm Up");

    const deleteResult = await client.callTool({
      name: "deleteExerciseCategory",
      arguments: {
        params: {
          id: categoryId,
        },
      },
    });
    const deleted = extractStructuredContent(deleteResult);
    assert.equal(deleted.ok, true);
    assert.equal(deleted.statusCode, 200);

    await client.close();
    await transport.close();
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("MCP surfaces admin auth, validation, not-found, and conflict errors", async () => {
  const context = createTestEnv();
  const authApp = buildApp({
    env: {
      ...context.env,
      MCP_ADMIN_TOKEN: "wrong-token",
    },
  });
  const validationApp = buildApp({ env: context.env });

  try {
    seedDatabase(authApp.db, context.env);
    const { client, transport } = await startMcpClient(authApp);

    const unauthorizedResult = await client.callTool({
      name: "listExerciseCategories",
      arguments: {},
    });
    const unauthorized = extractStructuredContent(unauthorizedResult);
    assert.equal(unauthorized.ok, false);
    assert.equal(unauthorized.statusCode, 401);

    await client.close();
    await transport.close();
    seedDatabase(validationApp.db, context.env);
    const validationClientContext = await startMcpClient(validationApp);

    const validationResult = await validationClientContext.client.callTool({
      name: "createExerciseCategory",
      arguments: {
        body: {
          name: "A",
        },
      },
    });
    const validation = extractStructuredContent(validationResult);
    assert.equal(validation.ok, false);
    assert.equal(validation.statusCode, 400);

    const missingResult = await validationClientContext.client.callTool({
      name: "getExerciseCategory",
      arguments: {
        params: {
          id: "category_missing",
        },
      },
    });
    const missing = extractStructuredContent(missingResult);
    assert.equal(missing.ok, false);
    assert.equal(missing.statusCode, 404);

    await validationClientContext.client.callTool({
      name: "createExerciseCategory",
      arguments: {
        body: {
          id: "category_duplicate",
          name: "Duplicate",
        },
      },
    });
    const conflictResult = await validationClientContext.client.callTool({
      name: "createExerciseCategory",
      arguments: {
        body: {
          id: "category_duplicate",
          name: "Duplicate",
        },
      },
    });
    const conflict = extractStructuredContent(conflictResult);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.statusCode, 409);

    await validationClientContext.client.close();
    await validationClientContext.transport.close();
  } finally {
    await authApp.close();
    await validationApp.close();
    context.cleanup();
  }
});
