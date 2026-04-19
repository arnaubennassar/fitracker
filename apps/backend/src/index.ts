import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

await start();
