import { loadEnv } from "../env.js";
import { createDatabase } from "./client.js";
import { migrateDatabase } from "./migrations.js";
import { seedDatabase } from "./seeds.js";

const env = loadEnv();
const db = createDatabase(env.DATABASE_PATH);

try {
  migrateDatabase(db);

  const summary = seedDatabase(db, env);

  console.log("Seed complete.");
  console.log(
    JSON.stringify(
      {
        adminTokenName: summary.adminToken.name,
        adminTokenPreview: summary.adminToken.preview,
        seededExercises: summary.counts.exercises,
        seededTemplates: summary.counts.workoutTemplates,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
