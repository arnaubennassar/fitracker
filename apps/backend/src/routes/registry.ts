import type {
  FastifyInstance,
  HTTPMethods,
  preHandlerHookHandler,
} from "fastify";

type JsonSchema = Record<string, unknown>;

type RouteParameter = {
  description?: string;
  in: "path" | "query";
  name: string;
  required: boolean;
  schema: JsonSchema;
};

export type OpenApiOperation = {
  operationId: string;
  parameters?: RouteParameter[];
  responses: Record<
    string,
    {
      content: Record<string, { schema: JsonSchema }>;
      description: string;
    }
  >;
  requestBody?: {
    content: Record<string, { schema: JsonSchema }>;
    required: boolean;
  };
  security?: Array<Record<string, string[]>>;
  summary: string;
  tags: string[];
};

export type OpenApiPathItem = Record<string, OpenApiOperation>;

export type AppRouteDefinition = {
  handler: Parameters<FastifyInstance["route"]>[0]["handler"];
  method: HTTPMethods;
  operationId: string;
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];
  response: Record<number, JsonSchema>;
  responseContentType: "application/json" | "text/html";
  responseDescriptions?: Record<number, string>;
  schema: {
    body?: JsonSchema;
    params?: JsonSchema;
    querystring?: JsonSchema;
    response: Record<number, JsonSchema>;
    responseContentType?: "application/json" | "text/html";
    summary: string;
    tags: string[];
  };
  security?: Array<Record<string, string[]>>;
  summary: string;
  tags: string[];
  url: string;
};

declare module "fastify" {
  interface FastifyInstance {
    routeIndex: AppRouteDefinition[];
  }
}

type BuildRouteSchemaOptions = {
  body?: JsonSchema;
  params?: JsonSchema;
  querystring?: JsonSchema;
  response: Record<number, JsonSchema>;
  responseContentType?: "application/json" | "text/html";
  summary: string;
  tags: string[];
};

export function buildRouteSchema(options: BuildRouteSchemaOptions) {
  return {
    ...(options.body ? { body: options.body } : {}),
    ...(options.params ? { params: options.params } : {}),
    ...(options.querystring ? { querystring: options.querystring } : {}),
    response: options.response,
    summary: options.summary,
    tags: options.tags,
    responseContentType: options.responseContentType ?? "application/json",
  };
}

export function registerRoutes(
  app: FastifyInstance,
  routes: AppRouteDefinition[],
) {
  app.decorate("routeIndex", routes);

  for (const route of routes) {
    const options: Parameters<FastifyInstance["route"]>[0] = {
      method: route.method,
      url: route.url,
      schema: route.schema,
      handler: route.handler,
    };

    if (route.preHandler) {
      options.preHandler = route.preHandler;
    }

    app.route(options);
  }
}
