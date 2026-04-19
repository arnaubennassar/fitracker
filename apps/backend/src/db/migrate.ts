import { loadEnv } from "../env.js";
import { createDatabase } from "./client.js";
import { migrateDatabase } from "./migrations.js";

const env = loadEnv();
const db = createDatabase(env.DATABASE_PATH);

try {
  const result = migrateDatabase(db);

  console.log(`Applied ${result.applied.length} migration(s).`);

  if (result.applied.length === 0) {
    console.log("Database schema already up to date.");
  } else {
    for (const migration of result.applied) {
      console.log(`- ${migration}`);
    }
  }
} finally {
  db.close();
}
