import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { AppEnv } from "../env.js";

const DEFAULT_MCP_ADMIN_TOKEN_FILENAME = "mcp-admin-token";

type McpAdminTokenConfig = Pick<
  AppEnv,
  "DATABASE_PATH" | "MCP_ADMIN_TOKEN" | "MCP_ADMIN_TOKEN_FILE"
>;

export function resolveMcpAdminTokenFilePath(config: McpAdminTokenConfig) {
  return (
    config.MCP_ADMIN_TOKEN_FILE ??
    join(dirname(config.DATABASE_PATH), DEFAULT_MCP_ADMIN_TOKEN_FILENAME)
  );
}

export function readMcpAdminToken(config: McpAdminTokenConfig) {
  const envToken = config.MCP_ADMIN_TOKEN?.trim();

  if (envToken) {
    return envToken;
  }

  const tokenFilePath = resolveMcpAdminTokenFilePath(config);

  if (!existsSync(tokenFilePath)) {
    return null;
  }

  const token = readFileSync(tokenFilePath, "utf8").trim();

  return token.length > 0 ? token : null;
}

export function writeMcpAdminToken(config: McpAdminTokenConfig, token: string) {
  const tokenFilePath = resolveMcpAdminTokenFilePath(config);

  mkdirSync(dirname(tokenFilePath), { recursive: true });
  writeFileSync(tokenFilePath, `${token}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(tokenFilePath, 0o600);

  return tokenFilePath;
}
