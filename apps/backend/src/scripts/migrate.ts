import { runMigrations } from "../db/migrate.js";

runMigrations();
console.log("Migrations applied.");
