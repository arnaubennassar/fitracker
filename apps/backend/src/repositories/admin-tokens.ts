import type { DatabaseSync } from "node:sqlite";

import { nowIso } from "../lib/time.js";

export type AdminTokenRecord = {
  id: string;
  name: string;
  token_hash: string;
  scopes_json: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function findActiveAdminTokens(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT id, name, token_hash, scopes_json, last_used_at, expires_at, created_at, revoked_at
       FROM admin_tokens
       WHERE revoked_at IS NULL`,
    )
    .all() as AdminTokenRecord[];
}

export function touchAdminToken(db: DatabaseSync, id: string) {
  db.prepare("UPDATE admin_tokens SET last_used_at = ? WHERE id = ?").run(
    nowIso(),
    id,
  );
}
