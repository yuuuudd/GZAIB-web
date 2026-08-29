import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const configPath = join(root, "wrangler.jsonc");
const readme = readFileSync(join(root, "README.md"), "utf8");
const viteConfig = readFileSync(join(root, "vite.config.ts"), "utf8");

test("local Demo migrations use a project-local Wrangler config with no remote resource id", () => {
  const config = readFileSync(configPath, "utf8");

  assert.match(config, /"d1_databases"/);
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.match(config, /"database_name"\s*:\s*"site-creator-d1"/);
  assert.match(config, /"database_id"\s*:\s*"00000000-0000-4000-8000-000000000000"/);
  assert.match(config, /"r2_buckets"/);
  assert.match(config, /"binding"\s*:\s*"AVATARS"/);
  assert.doesNotMatch(config, /--remote|account_id|api[_-]?token/i);

  // The Vite plugin remains the dev-server source of bindings; this contract
  // prevents the standalone CLI config from silently drifting away from it.
  assert.match(viteConfig, /compatibility_date:\s*"2026-08-30"/);
  assert.match(viteConfig, /database_name:\s*"site-creator-d1"/);
  assert.match(viteConfig, /binding:\s*d1/);
  assert.match(viteConfig, /binding:\s*r2/);
});

test("README gives the exact local-only config-backed migration commands in order", () => {
  const core = "npx.cmd wrangler d1 execute site-creator-d1 --local --config wrangler.jsonc --file=drizzle/0000_builder_map_core.sql --persist-to=.wrangler/state";
  const connections = "npx.cmd wrangler d1 execute site-creator-d1 --local --config wrangler.jsonc --file=drizzle/0001_member_connections.sql --persist-to=.wrangler/state";
  assert.ok(readme.indexOf(core) >= 0, "core migration command must be documented exactly");
  assert.ok(readme.indexOf(connections) > readme.indexOf(core), "connection migration must follow core migration");
  assert.match(readme, /\$env:WRANGLER_LOG_PATH\s*=\s*"\.wrangler\/logs"/);
  assert.match(readme, /\$env:MINIFLARE_REGISTRY_PATH\s*=\s*"\.wrangler\/registry"/);
  assert.doesNotMatch(readme, /wrangler d1 execute[^\n]*--remote/i);
  assert.doesNotMatch(readme, /--persist-to=\.wrangler\/state\/local-demo/);
});
