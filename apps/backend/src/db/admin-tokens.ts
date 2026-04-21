import type { DatabaseSync } from "node:sqlite";

import { hashAdminToken } from "../lib/admin-token.js";

type UpsertAdminTokenOptions = {
  createdAt: string;
  id: string;
  name: string;
  salt: string;
  scopes?: string[];
  token: string;
};

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function getTableColumns(db: DatabaseSync, tableName: string) {
  return new Set(
    (
      db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
}

export function upsertAdminToken(
  db: DatabaseSync,
  options: UpsertAdminTokenOptions,
) {
  const tokenHash = hashAdminToken(options.token, {
    salt: options.salt,
  });
  const tokenPreview = options.token.slice(-6);
  const tokenScopes = stringifyJson(options.scopes ?? ["admin:*"]);
  const columns = getTableColumns(db, "admin_tokens");

  if (columns.has("scopes_json")) {
    db.prepare(
      `
        INSERT INTO admin_tokens (
          id,
          name,
          token_hash,
          token_preview,
          scopes,
          scopes_json,
          last_used_at,
          expires_at,
          created_at,
          revoked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          token_hash = excluded.token_hash,
          token_preview = excluded.token_preview,
          scopes = excluded.scopes,
          scopes_json = excluded.scopes_json,
          revoked_at = NULL
      `,
    ).run(
      options.id,
      options.name,
      tokenHash,
      tokenPreview,
      tokenScopes,
      tokenScopes,
      options.createdAt,
    );
  } else {
    db.prepare(
      `
        INSERT INTO admin_tokens (
          id,
          name,
          token_hash,
          token_preview,
          scopes,
          last_used_at,
          expires_at,
          created_at,
          revoked_at
        )
        VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          token_hash = excluded.token_hash,
          token_preview = excluded.token_preview,
          scopes = excluded.scopes,
          revoked_at = NULL
      `,
    ).run(
      options.id,
      options.name,
      tokenHash,
      tokenPreview,
      tokenScopes,
      options.createdAt,
    );
  }

  return {
    id: options.id,
    name: options.name,
    preview: tokenPreview,
  };
}
