import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, normalizeLoginEmail, validatePassword, verifyPassword } from "../../features/identity/password";

test("normalizes a login email without accepting malformed addresses", () => {
  assert.equal(normalizeLoginEmail("  Builder@Example.COM "), "builder@example.com");
  for (const value of ["", "builder", "@example.com", "builder@example", "builder @example.com", 42]) {
    assert.throws(() => normalizeLoginEmail(value));
  }
});

test("accepts login passwords from six through one hundred twenty-eight characters", () => {
  assert.equal(validatePassword("123456"), "123456");
  assert.equal(validatePassword("密".repeat(128)), "密".repeat(128));
  assert.throws(() => validatePassword("12345"));
  assert.throws(() => validatePassword("密".repeat(129)));
  assert.throws(() => validatePassword(42));
});

test("verifies only the password used to create the irreversible digest", async () => {
  const digest = await hashPassword("correct horse battery", new Uint8Array(16).fill(7), 1_000);
  assert.equal(await verifyPassword("correct horse battery", digest), true);
  assert.equal(await verifyPassword("incorrect horse bat", digest), false);
  assert.equal(digest.salt, "BwcHBwcHBwcHBwcHBwcHBw==");
  assert.notEqual(digest.hash, "correct horse battery");
});
