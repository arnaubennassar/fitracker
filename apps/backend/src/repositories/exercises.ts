import type { DatabaseSync } from "node:sqlite";

export type ExerciseListItem = {
  id: string;
  slug: string;
  name: string;
  category_name: string;
  tracking_mode: string;
  difficulty: string;
  is_active: number;
};

export function listExercises(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT e.id, e.slug, e.name, c.name AS category_name, e.tracking_mode, e.difficulty, e.is_active
       FROM exercises e
       INNER JOIN exercise_categories c ON c.id = e.category_id
       ORDER BY c.name ASC, e.name ASC`,
    )
    .all() as ExerciseListItem[];
}
