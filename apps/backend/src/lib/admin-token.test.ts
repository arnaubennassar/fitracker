import assert from "node:assert/strict";
import test from "node:test";

import { hashAdminToken, verifyAdminToken } from "./admin-token.js";

test("hashAdminToken and verifyAdminToken accept a matching token", () => {
  const hash = hashAdminToken("fitracker-local-admin-token-for-tests", {
    salt: "pepper",
  });

  assert.equal(
    verifyAdminToken("fitracker-local-admin-token-for-tests", hash),
    true,
  );
});

test("verifyAdminToken rejects mismatched or malformed hashes", () => {
  const hash = hashAdminToken("fitracker-local-admin-token-for-tests", {
    salt: "pepper",
  });

  assert.equal(verifyAdminToken("wrong-token", hash), false);
  assert.equal(verifyAdminToken("token", "invalid"), false);
  assert.equal(verifyAdminToken("token", "pbkdf2$v1$salt$digest"), false);
  assert.equal(verifyAdminToken("token", "scrypt:v1$salt"), false);
});
