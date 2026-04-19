import { env } from "../env.js";

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Fitracker API",
      version: "0.1.0",
      description:
        "Phase 2 backend foundation for workout tracking and coach tooling.",
    },
    servers: [{ url: env.API_BASE_PATH }],
    components: {
      securitySchemes: {
        adminBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "token",
          description: "Coach/admin API token.",
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["status", "app", "version", "database"],
          properties: {
            status: { type: "string", examples: ["ok"] },
            app: { type: "string", examples: ["fitracker-backend"] },
            version: { type: "string", examples: ["0.1.0"] },
            database: { type: "string", examples: ["ready"] },
          },
        },
        AdminSessionResponse: {
          type: "object",
          required: ["tokenName", "scopes"],
          properties: {
            tokenName: { type: "string" },
            scopes: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    paths: {
      [`${env.API_BASE_PATH}/health`]: {
        get: {
          summary: "Health check",
          tags: ["system"],
          responses: {
            200: {
              description: "Service healthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      [`${env.API_BASE_PATH}/admin/session`]: {
        get: {
          summary: "Validate admin bearer token",
          tags: ["admin"],
          security: [{ adminBearer: [] }],
          responses: {
            200: {
              description: "Authenticated admin token details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminSessionResponse" },
                },
              },
            },
            401: {
              description: "Unauthorized",
            },
          },
        },
      },
      [`${env.API_BASE_PATH}/admin/exercises`]: {
        get: {
          summary: "List seeded exercises",
          tags: ["admin"],
          security: [{ adminBearer: [] }],
          responses: {
            200: {
              description: "Exercise list",
            },
          },
        },
      },
    },
  };
}

export function buildDocsHtml() {
  const openApiUrl = `${env.API_BASE_PATH}/openapi.json`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fitracker API Docs</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
      body { margin: 0; padding: 2rem; background: #0f172a; color: #e2e8f0; }
      .card { max-width: 48rem; margin: 0 auto; background: rgba(15,23,42,0.88); border: 1px solid rgba(148,163,184,0.2); border-radius: 1rem; padding: 1.5rem; }
      a { color: #38bdf8; }
      code, pre { font-family: ui-monospace, SFMono-Regular, monospace; }
      pre { overflow: auto; padding: 1rem; background: rgba(15,23,42,0.65); border-radius: 0.75rem; }
    </style>
  </head>
  <body>
    <main class="card">
      <p>Fitracker Phase 2 backend docs</p>
      <h1>OpenAPI</h1>
      <p>The live OpenAPI document is available at <a href="${openApiUrl}">${openApiUrl}</a>.</p>
      <p>Use the seeded admin bearer token from your local env for protected endpoints.</p>
      <pre><code>curl -H "Authorization: Bearer $ADMIN_SEED_TOKEN" http://localhost:${env.PORT}${env.API_BASE_PATH}/admin/session</code></pre>
    </main>
  </body>
</html>`;
}
