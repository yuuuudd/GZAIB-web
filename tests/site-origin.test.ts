import assert from "node:assert/strict";
import test from "node:test";
import { canonicalMetadataOrigin, configuredAppOrigin } from "../lib/site-origin";

test("uses only a valid configured APP_ORIGIN for public canonical metadata", () => {
  const origin = canonicalMetadataOrigin(new Headers({ host: "localhost", "x-forwarded-host": "attacker.test" }), "https://map.example.com");
  assert.equal(origin?.href, "https://map.example.com/");
});

test("omits non-local metadata for invalid or missing APP_ORIGIN regardless of forwarded host", () => {
  const headers = new Headers({ host: "public.example", "x-forwarded-host": "attacker.test" });
  assert.equal(canonicalMetadataOrigin(headers, "https://map.example.com/path"), undefined);
  assert.equal(canonicalMetadataOrigin(headers, undefined), undefined);
  assert.equal(configuredAppOrigin("https://map.example.com@attacker.test"), undefined);
});

test("permits only direct loopback host metadata for local development", () => {
  assert.equal(canonicalMetadataOrigin(new Headers({ host: "localhost", "x-forwarded-host": "attacker.test" }), undefined)?.href, "http://localhost/");
  assert.equal(canonicalMetadataOrigin(new Headers({ host: "localhost:3000" }), undefined)?.href, "http://localhost:3000/");
  assert.equal(canonicalMetadataOrigin(new Headers({ host: "127.0.0.1" }), undefined)?.href, "http://127.0.0.1/");
  assert.equal(canonicalMetadataOrigin(new Headers({ host: "[::1]" }), undefined)?.href, "http://[::1]/");
});
