import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { env } from "../env.js";

let database: DatabaseSync | undefined;

export function getDb() {
  if (!database) {
    const databasePath =
      env.DATABASE_PATH === ":memory:"
        ? env.DATABASE_PATH
        : resolve(process.cwd(), env.DATABASE_PATH);

    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON;");
  }

  return database;
}
