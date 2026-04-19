import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getDb } from "../db/client.js";
import { env } from "../env.js";
import { buildDocsHtml, buildOpenApiDocument } from "../openapi/document.js";

export async function registerSystemRoutes(app: FastifyInstance) {
  const healthHandler = async () => {
    getDb().prepare("SELECT 1").get();

    return {
      status: "ok",
      app: "fitracker-backend",
      version: "0.1.0",
      database: "ready",
    };
  };

  app.get("/health", healthHandler);
  app.get(`${env.API_BASE_PATH}/health`, healthHandler);

  app.get("/version", async () => ({ version: "0.1.0" }));
  app.get(`${env.API_BASE_PATH}/version`, async () => ({ version: "0.1.0" }));

  const openApiHandler = async () => buildOpenApiDocument();
  app.get("/openapi.json", openApiHandler);
  app.get(`${env.API_BASE_PATH}/openapi.json`, openApiHandler);

  const docsHandler = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.type("text/html; charset=utf-8").send(buildDocsHtml());

  app.get("/docs", docsHandler);
  app.get(`${env.API_BASE_PATH}/docs`, docsHandler);
}
