import { randomBytes } from "node:crypto";
import type { Writable } from "node:stream";

import { upsertAdminToken } from "./db/admin-tokens.js";
import { createDatabase } from "./db/client.js";
import { migrateDatabase } from "./db/migrations.js";
import { seedDatabase } from "./db/seeds.js";
import { loadEnv } from "./env.js";
import { writeMcpAdminToken } from "./lib/mcp-admin-auth.js";

const MANAGED_MCP_ADMIN_TOKEN_ID = "admin_token_mcp_managed";
const MANAGED_MCP_ADMIN_TOKEN_NAME = "MCP Admin Token";

type CliIo = {
  stderr: Writable;
  stdout: Writable;
};

type SetAdminAuthOptions = {
  name?: string;
  token?: string;
};

function parseSetAdminAuthOptions(argv: string[]) {
  const options: SetAdminAuthOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--token") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --token.");
      }

      options.token = value;
      index += 1;
      continue;
    }

    if (argument === "--name") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --name.");
      }

      options.name = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function buildManagedAdminToken() {
  return randomBytes(32).toString("base64url");
}

async function runSetAdminAuth(argv: string[], io: CliIo) {
  const options = parseSetAdminAuthOptions(argv);
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);
  const token = options.token ?? buildManagedAdminToken();
  const name = options.name ?? MANAGED_MCP_ADMIN_TOKEN_NAME;

  if (token.length < 24) {
    throw new Error("Admin token must be at least 24 characters long.");
  }

  try {
    migrateDatabase(db);

    const adminToken = upsertAdminToken(db, {
      createdAt: new Date().toISOString(),
      id: MANAGED_MCP_ADMIN_TOKEN_ID,
      name,
      salt: `managed:${MANAGED_MCP_ADMIN_TOKEN_ID}`,
      token,
    });
    const tokenFilePath = writeMcpAdminToken(env, token);

    io.stdout.write("Admin auth configured.\n");
    io.stdout.write(
      `${JSON.stringify(
        {
          adminTokenName: adminToken.name,
          adminTokenPreview: adminToken.preview,
          generated: options.token === undefined,
          tokenFilePath,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    db.close();
  }
}

async function runMigrate(io: CliIo) {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);

  try {
    const result = migrateDatabase(db);

    io.stdout.write(`Applied ${result.applied.length} migration(s).\n`);

    if (result.applied.length === 0) {
      io.stdout.write("Database schema already up to date.\n");
      return;
    }

    for (const migration of result.applied) {
      io.stdout.write(`- ${migration}\n`);
    }
  } finally {
    db.close();
  }
}

async function runSeed(io: CliIo) {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);

  try {
    migrateDatabase(db);

    const summary = seedDatabase(db, env);

    io.stdout.write("Seed complete.\n");
    io.stdout.write(
      `${JSON.stringify(
        {
          adminTokenName: summary.adminToken.name,
          adminTokenPreview: summary.adminToken.preview,
          seededExercises: summary.counts.exercises,
          seededTemplates: summary.counts.workoutTemplates,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    db.close();
  }
}

async function runServe() {
  const { buildApp } = await import("./app.js");

  const env = loadEnv();
  const app = buildApp({ env });

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

export async function runCli(
  argv: string[],
  io: CliIo = {
    stderr: process.stderr,
    stdout: process.stdout,
  },
) {
  const [command = "serve", ...rest] = argv;

  try {
    if (command === "serve") {
      await runServe();
      return;
    }

    if (command === "set-admin-auth") {
      await runSetAdminAuth(rest, io);
      return;
    }

    if (command === "migrate") {
      await runMigrate(io);
      return;
    }

    if (command === "seed") {
      await runSeed(io);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected CLI failure.";
    io.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
