CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('passkey_register', 'passkey_login')),
  challenge TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS auth_challenges_lookup_idx
  ON auth_challenges (flow_type, expires_at, used_at);

CREATE TABLE IF NOT EXISTS athlete_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS athlete_sessions_expiry_idx
  ON athlete_sessions (revoked_at, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_set_logs_unique_set_idx
  ON exercise_set_logs (workout_session_id, sequence, set_number);
