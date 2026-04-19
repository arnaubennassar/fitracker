import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

export function hashToken(token: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(token, salt, KEY_LENGTH).toString("hex");

  return `${HASH_PREFIX}:${salt}:${derivedKey}`;
}

export function verifyToken(token: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = storedHash.split(":");

  if (algorithm !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = scryptSync(token, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}
