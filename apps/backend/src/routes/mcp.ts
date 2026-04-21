import type { ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";
import { z } from "zod";

import { readMcpAdminToken } from "../lib/mcp-admin-auth.js";
import type { AppRouteDefinition } from "./registry.js";

type JsonSchema = Record<string, unknown>;

type McpToolArguments = {
  body?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

type StructuredToolResult = {
  data?: unknown;
  error?: unknown;
  ok: boolean;
  statusCode: number;
};

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null;
}

function buildNullUnion(values: z.ZodTypeAny[]) {
  if (values.length === 0) {
    return z.null();
  }

  const [first, second, ...rest] = values;

  if (!first) {
    return z.null();
  }

  if (!second) {
    return z.union([first, z.null()]);
  }

  return z.union([first, second, ...rest, z.null()] as unknown as [
    z.ZodTypeAny,
    z.ZodTypeAny,
    ...z.ZodTypeAny[],
  ]);
}

function buildLiteralUnion(values: unknown[]) {
  const literals = values
    .filter(
      (value): value is boolean | number | string | null =>
        value === null ||
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string",
    )
    .map((value) => z.literal(value));

  const [first, second, ...rest] = literals;

  if (!first) {
    return null;
  }

  if (!second) {
    return first;
  }

  return z.union([first, second, ...rest] as unknown as [
    z.ZodLiteral<boolean | number | string | null>,
    z.ZodLiteral<boolean | number | string | null>,
    ...z.ZodLiteral<boolean | number | string | null>[],
  ]);
}

function applyCommonSchemaMetadata(
  zodSchema: z.ZodTypeAny,
  jsonSchema: JsonSchema,
) {
  let schema = zodSchema;
  const description = jsonSchema.description;
  const defaultValue = jsonSchema.default;

  if (typeof description === "string" && description.length > 0) {
    schema = schema.describe(description);
  }

  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  }

  return schema;
}

function jsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumSchema = buildLiteralUnion(schema.enum);

    if (enumSchema) {
      return applyCommonSchemaMetadata(enumSchema, schema);
    }
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const variants = schema.anyOf
      .filter(isJsonSchema)
      .map((variant) => jsonSchemaToZod(variant));
    const nonNullVariants = variants.filter(
      (variant) => !(variant instanceof z.ZodNull),
    );
    const hasNullVariant = variants.length !== nonNullVariants.length;
    const [firstVariant, secondVariant, ...restVariants] = nonNullVariants;
    const unionSchema =
      firstVariant === undefined
        ? z.any()
        : secondVariant === undefined
          ? firstVariant
          : z.union([
              firstVariant,
              secondVariant,
              ...restVariants,
            ] as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);

    return applyCommonSchemaMetadata(
      hasNullVariant ? buildNullUnion(nonNullVariants) : unionSchema,
      schema,
    );
  }

  if (schema.type === "object" || isJsonSchema(schema.properties)) {
    const properties = isJsonSchema(schema.properties) ? schema.properties : {};
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );

    const shape = Object.fromEntries(
      Object.entries(properties).map(([name, propertySchema]) => {
        const resolvedProperty = isJsonSchema(propertySchema)
          ? jsonSchemaToZod(propertySchema)
          : z.any();
        const wrappedProperty = required.has(name)
          ? resolvedProperty
          : resolvedProperty.optional();
        return [name, wrappedProperty];
      }),
    );

    const baseObjectSchema =
      Object.keys(shape).length > 0 ? z.object(shape) : z.object({});
    const objectSchema =
      schema.additionalProperties === false
        ? baseObjectSchema.strict()
        : baseObjectSchema.passthrough();

    return applyCommonSchemaMetadata(objectSchema, schema);
  }

  if (schema.type === "array") {
    const itemSchema = isJsonSchema(schema.items)
      ? jsonSchemaToZod(schema.items)
      : z.any();
    return applyCommonSchemaMetadata(z.array(itemSchema), schema);
  }

  if (schema.type === "string") {
    return applyCommonSchemaMetadata(z.string(), schema);
  }

  if (schema.type === "integer") {
    return applyCommonSchemaMetadata(z.number().int(), schema);
  }

  if (schema.type === "number") {
    return applyCommonSchemaMetadata(z.number(), schema);
  }

  if (schema.type === "boolean") {
    return applyCommonSchemaMetadata(z.boolean(), schema);
  }

  if (schema.type === "null") {
    return applyCommonSchemaMetadata(z.null(), schema);
  }

  return applyCommonSchemaMetadata(z.any(), schema);
}

function buildToolSchema(route: AppRouteDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};

  if (isJsonSchema(route.schema.params)) {
    shape.params = jsonSchemaToZod(route.schema.params);
  }

  if (isJsonSchema(route.schema.querystring)) {
    shape.query = jsonSchemaToZod(route.schema.querystring).optional();
  }

  if (isJsonSchema(route.schema.body)) {
    shape.body = jsonSchemaToZod(route.schema.body);
  }

  return z.object(shape).strict();
}

function getAdminRoutes(app: FastifyInstance) {
  return app.routeIndex.filter((route) =>
    route.url.startsWith(`${app.config.API_BASE_PATH}/admin`),
  );
}

function getSchemaPropertyNames(schema: unknown) {
  if (!isJsonSchema(schema) || !isJsonSchema(schema.properties)) {
    return [];
  }

  return Object.keys(schema.properties);
}

function buildToolDescription(route: AppRouteDefinition) {
  const argumentParts = [
    route.schema.params ? "`params`" : null,
    route.schema.querystring ? "`query`" : null,
    route.schema.body ? "`body`" : null,
  ].filter((value): value is string => value !== null);

  const argumentSummary =
    argumentParts.length > 0
      ? `Pass request fields using ${argumentParts.join(", ")}.`
      : "This tool does not take custom arguments.";

  const hints = [
    getSchemaPropertyNames(route.schema.params).length > 0
      ? `Path keys must match exactly: ${getSchemaPropertyNames(
          route.schema.params,
        )
          .map((name) => `\`params.${name}\``)
          .join(", ")}.`
      : null,
    getSchemaPropertyNames(route.schema.querystring).length > 0
      ? `Query keys: ${getSchemaPropertyNames(route.schema.querystring)
          .map((name) => `\`query.${name}\``)
          .join(", ")}.`
      : null,
    isJsonSchema(route.schema.body) &&
    typeof route.schema.body.description === "string"
      ? route.schema.body.description
      : null,
  ].filter((value): value is string => value !== null);

  return [
    route.summary,
    `Maps to ${route.method} ${route.url}.`,
    argumentSummary,
    ...hints,
  ].join(" ");
}

function buildQueryString(query: Record<string, unknown> | undefined) {
  const search = new URLSearchParams();

  if (!query) {
    return "";
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, String(item));
      }
      continue;
    }

    search.set(key, String(value));
  }

  const suffix = search.toString();

  return suffix.length > 0 ? `?${suffix}` : "";
}

function buildRouteUrl(
  route: AppRouteDefinition,
  params: Record<string, unknown> | undefined,
  query: Record<string, unknown> | undefined,
) {
  const interpolated = route.url.replaceAll(
    /:([A-Za-z0-9_]+)/g,
    (_match, key: string) => encodeURIComponent(String(params?.[key] ?? "")),
  );

  return `${interpolated}${buildQueryString(query)}`;
}

function parseJsonBody(body: string) {
  if (body.length === 0) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function buildStructuredToolResult(
  statusCode: number,
  payload: unknown,
  ok: boolean,
): StructuredToolResult {
  return ok
    ? {
        data: payload,
        ok: true,
        statusCode,
      }
    : {
        error: payload,
        ok: false,
        statusCode,
      };
}

function formatToolResult(result: StructuredToolResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    isError: !result.ok,
    structuredContent: result,
  };
}

async function invokeAdminRoute(
  app: FastifyInstance,
  route: AppRouteDefinition,
  args: McpToolArguments,
) {
  const adminToken =
    readMcpAdminToken(app.config) ?? app.config.ADMIN_SEED_TOKEN;
  const method = route.method === "SEARCH" ? "GET" : route.method;
  const requestOptions = {
    ...(route.schema.body && args.body !== undefined
      ? { payload: args.body as InjectOptions["payload"] }
      : {}),
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    method: method as Exclude<HTTPMethods, "SEARCH">,
    url: buildRouteUrl(route, args.params, args.query),
  };

  const response: LightMyRequestResponse = await app.inject(
    requestOptions as unknown as InjectOptions,
  );

  const parsedBody =
    response.statusCode === 204 ? null : parseJsonBody(response.body);
  const toolResult = buildStructuredToolResult(
    response.statusCode,
    parsedBody,
    response.statusCode >= 200 && response.statusCode < 300,
  );

  return formatToolResult(toolResult);
}

function createMcpServer(app: FastifyInstance) {
  const server = new McpServer(
    {
      name: "fitracker-admin-mcp",
      version: "0.1.0",
    },
    {
      instructions:
        "Use the endpoint-mapped admin tools. Tool names match existing admin operationIds and expect HTTP-style arguments grouped under params, query, and body.",
    },
  );

  for (const route of getAdminRoutes(app)) {
    server.registerTool(
      route.operationId,
      {
        annotations: {
          openWorldHint: false,
          readOnlyHint: route.method === "GET",
          title: route.summary,
        },
        description: buildToolDescription(route),
        inputSchema: buildToolSchema(route),
      },
      async (args) => invokeAdminRoute(app, route, args as McpToolArguments),
    );
  }

  return server;
}

function writeJsonRpcError(
  response: ServerResponse,
  code: number,
  message: string,
) {
  response.statusCode = 500;
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      error: {
        code,
        message,
      },
      id: null,
      jsonrpc: "2.0",
    }),
  );
}

async function handleMcpRequest(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  reply.hijack();

  const server = createMcpServer(app);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport as never);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  } catch (error) {
    request.log.error(error);

    if (!reply.raw.headersSent) {
      writeJsonRpcError(reply.raw, -32603, "Internal server error");
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

export function registerMcpRoutes(app: FastifyInstance) {
  app.post(app.config.MCP_BASE_PATH, async (request, reply) => {
    await handleMcpRequest(app, request, reply);
  });

  app.get(app.config.MCP_BASE_PATH, async (_request, reply) => {
    return reply.code(405).header("allow", "POST").send("Method Not Allowed");
  });

  app.delete(app.config.MCP_BASE_PATH, async (_request, reply) => {
    return reply.code(405).header("allow", "POST").send("Method Not Allowed");
  });
}
