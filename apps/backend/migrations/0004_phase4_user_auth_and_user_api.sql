CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('passkey_register', 'passkey_login')),
  challenge TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS auth_challenges_lookup_idx
  ON auth_challenges (flow_type, expires_at, used_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON user_sessions (user_id, revoked_at, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_set_logs_unique_set_idx
  ON exercise_set_logs (workout_session_id, sequence, set_number);

ALTER TABLE workout_feedback
ADD COLUMN mood TEXT;

ALTER TABLE workout_feedback
ADD COLUMN difficulty_rating INTEGER CHECK (difficulty_rating IS NULL OR difficulty_rating BETWEEN 1 AND 10);

ALTER TABLE workout_feedback
ADD COLUMN energy_rating INTEGER CHECK (energy_rating IS NULL OR energy_rating BETWEEN 1 AND 5);

ALTER TABLE workout_feedback
ADD COLUMN pain_flag INTEGER NOT NULL DEFAULT 0 CHECK (pain_flag IN (0, 1));

ALTER TABLE workout_feedback
ADD COLUMN pain_notes TEXT;

ALTER TABLE workout_feedback
ADD COLUMN free_text TEXT;

UPDATE workout_feedback
SET difficulty_rating = COALESCE(difficulty_rating, overall_difficulty),
    energy_rating = COALESCE(energy_rating, energy_level),
    free_text = COALESCE(free_text, notes);
