import type { FastifyReply } from "fastify";

type CookieOptions = {
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "None" | "Strict";
  secure?: boolean;
};

export function parseCookies(headerValue?: string) {
  const cookies: Record<string, string> = {};

  if (!headerValue) {
    return cookies;
  }

  for (const pair of headerValue.split(";")) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");

    if (!rawName) {
      continue;
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join("="));
  }

  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly ?? true) {
    parts.push("HttpOnly");
  }

  if (options.sameSite ?? "Lax") {
    parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join("; ");
}

export function appendSetCookieHeader(reply: FastifyReply, cookie: string) {
  const existing = reply.getHeader("set-cookie");

  if (!existing) {
    reply.header("set-cookie", cookie);
    return;
  }

  if (Array.isArray(existing)) {
    reply.header("set-cookie", [...existing, cookie]);
    return;
  }

  reply.header("set-cookie", [String(existing), cookie]);
}
