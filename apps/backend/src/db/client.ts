import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function resolveDatabasePath(databasePath: string) {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  return resolve(process.cwd(), databasePath);
}

export function createDatabase(databasePath: string) {
  const resolvedPath = resolveDatabasePath(databasePath);

  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), {
      recursive: true,
    });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec("PRAGMA foreign_keys = ON");

  if (resolvedPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }

  return db;
}
