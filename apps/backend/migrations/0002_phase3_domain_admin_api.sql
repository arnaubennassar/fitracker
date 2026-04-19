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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS workout_assignments_user_idx
  ON workout_assignments (user_id, is_active, starts_on);

CREATE INDEX IF NOT EXISTS workout_assignments_template_idx
  ON workout_assignments (workout_template_id);

INSERT INTO workout_assignments (
  id,
  user_id,
  workout_template_id,
  assigned_by,
  starts_on,
  ends_on,
  schedule_notes,
  frequency_per_week,
  is_active,
  created_at,
  updated_at
)
SELECT
  legacy.id,
  legacy.user_id,
  legacy.workout_template_id,
  legacy.assigned_by,
  legacy.starts_on,
  legacy.ends_on,
  legacy.schedule_notes,
  NULL,
  legacy.is_active,
  COALESCE(legacy.starts_on || 'T00:00:00.000Z', CURRENT_TIMESTAMP),
  COALESCE(legacy.starts_on || 'T00:00:00.000Z', CURRENT_TIMESTAMP)
FROM workout_plan_assignments AS legacy
WHERE legacy.workout_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM workout_assignments AS current
    WHERE current.id = legacy.id
  );

CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS workout_sessions_user_idx
  ON workout_sessions (user_id, started_at DESC);

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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES workout_assignments(id) ON DELETE SET NULL,
  overall_difficulty INTEGER,
  energy_level INTEGER,
  soreness_level INTEGER,
  satisfaction INTEGER,
  notes TEXT,
  submitted_at TEXT NOT NULL,
  CHECK (overall_difficulty IS NULL OR overall_difficulty BETWEEN 1 AND 10),
  CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5),
  CHECK (soreness_level IS NULL OR soreness_level BETWEEN 1 AND 5),
  CHECK (satisfaction IS NULL OR satisfaction BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS workout_feedback_user_idx
  ON workout_feedback (user_id, submitted_at DESC);
