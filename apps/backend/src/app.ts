import Fastify from "fastify";

import { runMigrations } from "./db/migrate.js";
import { seedDatabase } from "./db/seed.js";
import { env } from "./env.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSystemRoutes } from "./routes/system.js";

export function buildApp() {
  runMigrations();
  seedDatabase();

  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  app.get("/", async () => ({
    app: "fitracker-backend",
    docs: "/docs",
    health: "/health",
  }));

  registerSystemRoutes(app);
  registerAdminRoutes(app);

  return app;
}
