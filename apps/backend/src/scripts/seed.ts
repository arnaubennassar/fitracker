import { runMigrations } from "../db/migrate.js";
import { seedDatabase } from "../db/seed.js";

runMigrations();
const result = seedDatabase();
console.log(JSON.stringify(result, null, 2));
