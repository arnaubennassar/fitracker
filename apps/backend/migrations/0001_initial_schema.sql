CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE exercise_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  equipment TEXT,
  tracking_mode TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  primary_muscles_json TEXT NOT NULL,
  secondary_muscles_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES exercise_categories(id)
);

CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  estimated_duration_min INTEGER,
  difficulty TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workout_template_exercises (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  block_label TEXT NOT NULL,
  instruction_override TEXT,
  target_sets INTEGER,
  target_reps TEXT,
  target_duration_seconds INTEGER,
  rest_seconds INTEGER,
  tempo TEXT,
  rpe_target REAL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE UNIQUE INDEX workout_template_exercises_sequence_idx
  ON workout_template_exercises(workout_template_id, sequence);
