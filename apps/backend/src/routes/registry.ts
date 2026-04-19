import type {
  FastifyInstance,
  HTTPMethods,
  RouteHandlerMethod,
  preHandlerHookHandler,
} from "fastify";

type JsonSchema = Record<string, unknown>;

export type OpenApiOperation = {
  operationId: string;
  responses: Record<
    string,
    {
      content: Record<string, { schema: JsonSchema }>;
      description: string;
    }
  >;
  security?: Array<{ bearerAuth: string[] }>;
  summary: string;
  tags: string[];
};

export type OpenApiPathItem = Record<string, OpenApiOperation>;

export type AppRouteDefinition = {
  handler: RouteHandlerMethod;
  method: HTTPMethods;
  operationId: string;
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];
  response: Record<number, JsonSchema>;
  responseContentType: "application/json" | "text/html";
  responseDescriptions?: Record<number, string>;
  schema: {
    response: Record<number, JsonSchema>;
    summary: string;
    tags: string[];
  };
  security?: Array<{ bearerAuth: string[] }>;
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
  response: Record<number, JsonSchema>;
  responseContentType?: "application/json" | "text/html";
  summary: string;
  tags: string[];
};

export function buildRouteSchema(options: BuildRouteSchemaOptions) {
  return {
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
