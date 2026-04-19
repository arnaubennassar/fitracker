ALTER TABLE workout_feedback
RENAME TO workout_feedback_legacy;

DROP INDEX IF EXISTS workout_feedback_user_idx;

CREATE TABLE workout_feedback (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood TEXT,
  difficulty_rating INTEGER CHECK (difficulty_rating IS NULL OR difficulty_rating BETWEEN 1 AND 10),
  energy_rating INTEGER CHECK (energy_rating IS NULL OR energy_rating BETWEEN 1 AND 5),
  pain_flag INTEGER NOT NULL DEFAULT 0 CHECK (pain_flag IN (0, 1)),
  pain_notes TEXT,
  free_text TEXT,
  submitted_at TEXT NOT NULL
);

INSERT INTO workout_feedback (
  id,
  workout_session_id,
  user_id,
  mood,
  difficulty_rating,
  energy_rating,
  pain_flag,
  pain_notes,
  free_text,
  submitted_at
)
SELECT
  id,
  workout_session_id,
  user_id,
  mood,
  COALESCE(difficulty_rating, overall_difficulty),
  COALESCE(energy_rating, energy_level),
  COALESCE(pain_flag, 0),
  pain_notes,
  COALESCE(free_text, notes),
  submitted_at
FROM workout_feedback_legacy;

CREATE INDEX IF NOT EXISTS workout_feedback_user_idx
  ON workout_feedback (user_id, submitted_at DESC);

DROP TABLE workout_feedback_legacy;
