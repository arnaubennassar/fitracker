ALTER TABLE exercise_media
ADD COLUMN created_at TEXT;

ALTER TABLE workout_template_exercises
ADD COLUMN target_reps INTEGER;

ALTER TABLE workout_template_exercises
ADD COLUMN target_weight REAL;

ALTER TABLE workout_template_exercises
ADD COLUMN target_weight_unit TEXT;

ALTER TABLE workout_template_exercises
ADD COLUMN target_distance_meters REAL;

ALTER TABLE workout_template_exercises
ADD COLUMN rir_target INTEGER;

CREATE TABLE IF NOT EXISTS workout_assignments (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE RESTRICT,
  assigned_by TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  schedule_notes TEXT,
  frequency_per_week INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (frequency_per_week IS NULL OR frequency_per_week >= 1)
);

CREATE INDEX IF NOT EXISTS workout_assignments_active_idx
  ON workout_assignments (is_active, starts_on);

CREATE INDEX IF NOT EXISTS workout_assignments_template_idx
  ON workout_assignments (workout_template_id);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE RESTRICT,
  assignment_id TEXT REFERENCES workout_assignments(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_seconds INTEGER,
  performed_version_snapshot TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS workout_sessions_started_idx
  ON workout_sessions (started_at DESC);

CREATE INDEX IF NOT EXISTS workout_sessions_assignment_idx
  ON workout_sessions (assignment_id, status);

CREATE TABLE IF NOT EXISTS exercise_set_logs (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  workout_template_exercise_id TEXT REFERENCES workout_template_exercises(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  performed_reps INTEGER,
  performed_weight REAL,
  performed_weight_unit TEXT,
  performed_duration_seconds INTEGER,
  performed_distance_meters REAL,
  rest_seconds_actual INTEGER,
  rpe INTEGER,
  completed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS exercise_set_logs_session_idx
  ON exercise_set_logs (workout_session_id, sequence, set_number);

CREATE TABLE IF NOT EXISTS workout_feedback (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES workout_assignments(id) ON DELETE SET NULL,
  mood TEXT,
  difficulty_rating INTEGER CHECK (difficulty_rating IS NULL OR difficulty_rating BETWEEN 1 AND 10),
  energy_rating INTEGER CHECK (energy_rating IS NULL OR energy_rating BETWEEN 1 AND 5),
  pain_flag INTEGER NOT NULL DEFAULT 0 CHECK (pain_flag IN (0, 1)),
  pain_notes TEXT,
  free_text TEXT,
  submitted_at TEXT NOT NULL,
  CHECK (assignment_id IS NULL OR assignment_id <> '')
);

CREATE INDEX IF NOT EXISTS workout_feedback_submitted_idx
  ON workout_feedback (submitted_at DESC);
