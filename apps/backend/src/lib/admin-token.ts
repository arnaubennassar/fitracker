import { scryptSync, timingSafeEqual } from "node:crypto";

const TOKEN_HASH_VERSION = "scrypt:v1";

type HashAdminTokenOptions = {
  salt: string;
};

function deriveTokenHash(token: string, salt: string) {
  return scryptSync(token, salt, 64).toString("hex");
}

export function hashAdminToken(token: string, options: HashAdminTokenOptions) {
  return `${TOKEN_HASH_VERSION}$${options.salt}$${deriveTokenHash(token, options.salt)}`;
}

export function verifyAdminToken(token: string, storedHash: string) {
  const [version, salt, storedDigest] = storedHash.split("$");

  if (version !== TOKEN_HASH_VERSION || !salt || !storedDigest) {
    return false;
  }

  const expected = Buffer.from(storedDigest, "hex");
  const actual = Buffer.from(deriveTokenHash(token, salt), "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
