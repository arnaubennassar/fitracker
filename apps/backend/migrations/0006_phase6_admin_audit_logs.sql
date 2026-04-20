CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_token_id TEXT NOT NULL,
  admin_token_name TEXT NOT NULL,
  method TEXT NOT NULL,
  route_path TEXT NOT NULL,
  request_path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  request_params TEXT,
  request_query TEXT,
  request_body TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_token_id) REFERENCES admin_tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_token_created
  ON admin_audit_logs(admin_token_id, created_at DESC);
