import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

export type MigrationStatus = {
  applied: string[];
};

type AppliedMigrationRow = {
  checksum: string;
  name: string;
};

function getMigrationDirectory() {
  return join(fileURLToPath(new URL("../../migrations", import.meta.url)));
}

function getMigrationChecksum(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function ensureMigrationTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __app_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function getAppliedMigrations(db: DatabaseSync) {
  return db
    .prepare("SELECT name, checksum FROM __app_migrations ORDER BY name ASC")
    .all() as AppliedMigrationRow[];
}

function listMigrationFiles() {
  return readdirSync(getMigrationDirectory())
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
}

export function getMigrationCount(db: DatabaseSync) {
  ensureMigrationTable(db);

  const row = db
    .prepare("SELECT COUNT(*) AS count FROM __app_migrations")
    .get() as {
    count: number;
  };

  return row.count;
}

export function migrateDatabase(db: DatabaseSync): MigrationStatus {
  ensureMigrationTable(db);

  const appliedByName = new Map(
    getAppliedMigrations(db).map((migration) => [
      migration.name,
      migration.checksum,
    ]),
  );
  const applied: string[] = [];

  for (const fileName of listMigrationFiles()) {
    const contents = readFileSync(
      join(getMigrationDirectory(), fileName),
      "utf8",
    );
    const checksum = getMigrationChecksum(contents);
    const existingChecksum = appliedByName.get(fileName);

    if (existingChecksum) {
      if (existingChecksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for ${fileName}. Create a new migration instead of editing an applied one.`,
        );
      }

      continue;
    }

    try {
      db.exec("BEGIN");
      db.exec(contents);
      db.prepare(
        `
          INSERT INTO __app_migrations (name, checksum, applied_at)
          VALUES (?, ?, ?)
        `,
      ).run(fileName, checksum, new Date().toISOString());
      db.exec("COMMIT");
      applied.push(fileName);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    applied,
  };
}
