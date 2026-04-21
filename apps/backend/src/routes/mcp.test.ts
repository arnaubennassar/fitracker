import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { buildApp } from "../app.js";
import { upsertAdminToken } from "../db/admin-tokens.js";
import { seedDatabase } from "../db/seeds.js";
import { writeMcpAdminToken } from "../lib/mcp-admin-auth.js";
import { createTestEnv } from "../test-helpers.js";

type McpClientContext = {
  client: Client;
  transport: StreamableHTTPClientTransport;
};

type ToolWithInputSchema = {
  description?: string;
  inputSchema: Record<string, unknown>;
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

function findTool(
  toolsResult: Awaited<ReturnType<Client["listTools"]>>,
  name: string,
) {
  const tool = toolsResult.tools.find((item) => item.name === name);
  assert.ok(tool, `Expected tool ${name} to be exposed over MCP.`);
  return tool;
}

function getNestedObject(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const nested = (value as Record<string, unknown>)[key];

  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
    return undefined;
  }

  return nested as Record<string, unknown>;
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

test("MCP exposes workout authoring enums and exact param hints", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    seedDatabase(app.db, context.env);
    const { client, transport } = await startMcpClient(app);
    const toolsResult = await client.listTools();

    const createExerciseTool = findTool(
      toolsResult,
      "createExercise",
    ) as ToolWithInputSchema;
    const createWorkoutTemplateTool = findTool(
      toolsResult,
      "createWorkoutTemplate",
    ) as ToolWithInputSchema;
    const createWorkoutTemplateExerciseTool = findTool(
      toolsResult,
      "createWorkoutTemplateExercise",
    ) as ToolWithInputSchema;
    const createExerciseBodySchema = getNestedObject(
      createExerciseTool.inputSchema,
      "properties",
    );
    const createExerciseBodyProperties = getNestedObject(
      getNestedObject(createExerciseBodySchema, "body"),
      "properties",
    );
    const createExerciseTrackingModeSchema = getNestedObject(
      createExerciseBodyProperties,
      "trackingMode",
    );
    const workoutTemplateExerciseParamsSchema = getNestedObject(
      getNestedObject(
        createWorkoutTemplateExerciseTool.inputSchema,
        "properties",
      ),
      "params",
    );
    const workoutTemplateIdSchema = getNestedObject(
      getNestedObject(workoutTemplateExerciseParamsSchema, "properties"),
      "workoutId",
    );

    assert.equal(
      Array.isArray(createExerciseTrackingModeSchema?.enum)
        ? createExerciseTrackingModeSchema.enum.join(",")
        : undefined,
      "distance,mixed,reps,time",
    );
    assert.match(createExerciseTool.description ?? "", /strict enum/i);
    assert.match(
      createWorkoutTemplateTool.description ?? "",
      /created atomically/i,
    );
    assert.match(
      createWorkoutTemplateExerciseTool.description ?? "",
      /params\.workoutId/,
    );
    assert.match(
      typeof workoutTemplateIdSchema?.description === "string"
        ? workoutTemplateIdSchema.description
        : "",
      /params\.workoutId/,
    );

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

test("MCP createWorkoutTemplate rolls back nested create failures", async () => {
  const context = createTestEnv();
  const app = buildApp({ env: context.env });

  try {
    seedDatabase(app.db, context.env);
    const { client, transport } = await startMcpClient(app);

    const failureResult = await client.callTool({
      name: "createWorkoutTemplate",
      arguments: {
        body: {
          slug: "atomic-template",
          name: "Atomic Template",
          exercises: [
            {
              exerciseId: "exercise_goblet_squat",
              sequence: 1,
              blockLabel: "Main",
              targetReps: 8,
            },
            {
              exerciseId: "exercise_missing",
              sequence: 2,
              blockLabel: "Accessory",
            },
          ],
        },
      },
    });
    const failed = extractStructuredContent(failureResult);
    assert.equal(failed.ok, false);
    assert.equal(failed.statusCode, 409);
    assert.equal(
      (failed.error as { code?: string }).code,
      "WORKOUT_TEMPLATE_CONFLICT_REFERENCE",
    );

    const listResult = await client.callTool({
      name: "listWorkoutTemplates",
      arguments: {
        query: {
          search: "atomic-template",
        },
      },
    });
    const listed = extractStructuredContent(listResult);
    assert.equal(listed.ok, true);
    assert.equal(
      (listed.data as { items: Array<{ slug: string }> }).items.length,
      0,
    );

    await client.close();
    await transport.close();
  } finally {
    await app.close();
    context.cleanup();
  }
});

test("MCP can use a persisted token file instead of ADMIN_SEED_TOKEN", async () => {
  const context = createTestEnv();
  const app = buildApp({
    env: {
      ...context.env,
      ADMIN_SEED_TOKEN: "fitracker-wrong-seed-token-for-mcp",
    },
  });

  try {
    seedDatabase(app.db, context.env);
    upsertAdminToken(app.db, {
      createdAt: new Date().toISOString(),
      id: "admin_token_mcp_managed",
      name: "MCP Admin Token",
      salt: "managed:admin_token_mcp_managed",
      token: "fitracker-mcp-token-from-file",
    });
    writeMcpAdminToken(app.config, "fitracker-mcp-token-from-file");

    const { client, transport } = await startMcpClient(app);
    const listResult = await client.callTool({
      name: "listExerciseCategories",
      arguments: {},
    });
    const listed = extractStructuredContent(listResult);
    assert.equal(listed.ok, true);
    assert.equal(listed.statusCode, 200);

    await client.close();
    await transport.close();
  } finally {
    await app.close();
    context.cleanup();
  }
});
