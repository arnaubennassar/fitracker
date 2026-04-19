import { nowIso } from "../lib/time.js";
import { getDb } from "./client.js";
import { migrationTableSql, migrations } from "./schema.js";

export function runMigrations() {
  const db = getDb();

  db.exec(migrationTableSql);

  const applied = new Set(
    (
      db
        .prepare("SELECT name FROM schema_migrations ORDER BY id ASC")
        .all() as Array<{
        name: string;
      }>
    ).map((entry) => entry.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    db.exec("BEGIN");

    try {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
      ).run(migration.name, nowIso());
      db.exec("COMMIT");
      applied.add(migration.name);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
