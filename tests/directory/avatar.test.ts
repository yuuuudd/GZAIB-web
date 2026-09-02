import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import {
  createAvatarKey,
  getNicknameInitial,
  handleAvatarRead,
  handleAvatarUpload,
  isAvatarKey,
  isOwnedAvatarKey,
  storeAvatar,
  validateAvatar,
} from "../../features/directory/avatar";

const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegSignature = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const webpSignature = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function candidate(type: string, bytes: Uint8Array, size = bytes.byteLength) {
  return { type, size, bytes };
}

function avatarRequest(file: Blob = new Blob([pngSignature], { type: "image/png" })) {
  const form = new FormData();
  form.set("avatar", file, "avatar.png");
  return new Request("https://site.test/api/uploads/avatar", { method: "POST", body: form });
}

test("accepts only JPEG, PNG, and WebP files whose declared MIME matches their signature", () => {
  assert.equal(validateAvatar(candidate("image/jpeg", jpegSignature)).ok, true);
  assert.equal(validateAvatar(candidate("image/png", pngSignature)).ok, true);
  assert.equal(validateAvatar(candidate("image/webp", webpSignature)).ok, true);
  assert.equal(validateAvatar(candidate("image/png", jpegSignature)).ok, false);
  assert.equal(validateAvatar(candidate("image/jpeg", new Uint8Array([0x41, 0x42, 0x43]))).ok, false);
});

test("rejects GIF, SVG, empty files, and source files over five MiB", () => {
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
  assert.equal(validateAvatar(candidate("image/gif", gif)).ok, false);
  assert.equal(validateAvatar(candidate("image/svg+xml", svg)).ok, false);
  assert.equal(validateAvatar(candidate("image/png", pngSignature, 0)).ok, false);
  assert.equal(validateAvatar(candidate("image/png", pngSignature, 5 * 1024 * 1024 + 1)).ok, false);
});

test("creates immutable owner-scoped WebP keys and rejects keys outside the route allowlist", () => {
  const key = createAvatarKey("user-1", "webp");
  assert.match(key, /^avatars\/user-1\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/);
  assert.equal(isAvatarKey(key), true);
  assert.equal(isAvatarKey("avatars/user-1/../private.webp"), false);
  assert.equal(isAvatarKey("avatars/user-1/file.png"), false);
  assert.equal(isAvatarKey("other/user-1/123e4567-e89b-42d3-a456-426614174000.webp"), false);
});

test("accepts the ChatGPT-prefixed account IDs used for uploaded-avatar ownership", () => {
  const key = createAvatarKey("chatgpt:user-1", "png");
  assert.equal(isAvatarKey(key), true);
  assert.equal(isOwnedAvatarKey(key, "chatgpt:user-1"), true);
});

test("stores a validated PNG in R2 without requiring the unavailable Images service", async () => {
  let stored: { key: string; body: Uint8Array; options?: Record<string, unknown> } | undefined;
  const result = await storeAvatar("user-1", new Blob([pngSignature], { type: "image/png" }), {
    avatars: {
      put: async (key, body, options) => {
        stored = { key, body: new Uint8Array(await new Response(body).arrayBuffer()), options };
      },
    },
  });

  assert.match(result.objectKey, /^avatars\/user-1\/.+\.png$/);
  assert.equal(stored?.key, result.objectKey);
  assert.deepEqual(stored?.body, pngSignature);
  assert.deepEqual(stored?.options, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
  });
});

test("rejects anonymous upload requests before parsing or storing the file", async () => {
  let stored = false;
  const response = await handleAvatarUpload(avatarRequest(), {
    authenticate: async () => null,
    store: async () => { stored = true; return { objectKey: "unused", publicUrl: "unused" }; },
    replaceReferences: async () => [],
    remove: async () => undefined,
    reportFailure: () => undefined,
  });
  assert.equal(response.status, 401);
  assert.equal(stored, false);
});

test("rejects invalid avatar uploads with 400 instead of invoking platform storage", async () => {
  let stored = false;
  const response = await handleAvatarUpload(avatarRequest(new Blob(["<svg/>"] , { type: "image/svg+xml" })), {
    authenticate: async () => "user-1",
    store: async () => { stored = true; return { objectKey: "unused", publicUrl: "unused" }; },
    replaceReferences: async () => [],
    remove: async () => undefined,
    reportFailure: () => undefined,
  });
  assert.equal(response.status, 400);
  assert.equal(stored, false);
});

test("rejects a declared multipart body over the hard ceiling before parsing or storing", async () => {
  let stored = false;
  const request = avatarRequest();
  const headers = new Headers(request.headers);
  headers.set("content-length", String(6 * 1024 * 1024 + 1));
  const response = await handleAvatarUpload(new Request(request, { headers }), {
    authenticate: async () => "user-1",
    store: async () => { stored = true; return { objectKey: "unused", publicUrl: "unused" }; },
    replaceReferences: async () => [], remove: async () => undefined, reportFailure: () => undefined,
  });
  assert.equal(response.status, 413);
  assert.equal(stored, false);
});

test("rejects a chunked multipart body over the hard ceiling before parsing or storing", async () => {
  let stored = false;
  const boundary = "upload-boundary";
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(6 * 1024 * 1024)); controller.enqueue(new Uint8Array([1])); controller.close(); },
  });
  const response = await handleAvatarUpload(new Request("https://site.test/api/uploads/avatar", {
    method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, body: stream, duplex: "half" as never,
  }), {
    authenticate: async () => "user-1",
    store: async () => { stored = true; return { objectKey: "unused", publicUrl: "unused" }; },
    replaceReferences: async () => [], remove: async () => undefined, reportFailure: () => undefined,
  });
  assert.equal(response.status, 413);
  assert.equal(stored, false);
});

test("hides missing platform bindings behind a generic upload error", async () => {
  const response = await handleAvatarUpload(avatarRequest(), {
    authenticate: async () => "user-1",
    store: async () => { throw new Error("IMAGES binding missing: internal-account-id"); },
    replaceReferences: async () => [],
    remove: async () => undefined,
    reportFailure: () => undefined,
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "头像暂时无法上传" });
});

test("publishes the new D1 reference before deleting the replaced immutable object", async () => {
  const events: string[] = [];
  const objectKey = "avatars/user-1/123e4567-e89b-42d3-a456-426614174000.webp";
  const oldKey = "avatars/user-1/223e4567-e89b-42d3-a456-426614174000.webp";
  const response = await handleAvatarUpload(avatarRequest(), {
    authenticate: async () => "user-1",
    store: async () => { events.push("store-new"); return { objectKey, publicUrl: `/api/avatars/${objectKey}` }; },
    replaceReferences: async () => { events.push("update-d1"); return [oldKey]; },
    remove: async () => { events.push("delete-old"); },
    reportFailure: () => undefined,
  });
  assert.equal(response.status, 201);
  assert.deepEqual(events, ["store-new", "update-d1", "delete-old"]);
  assert.deepEqual(await response.json(), { objectKey, publicUrl: `/api/avatars/${objectKey}` });
});

test("keeps a visible replacement when cleanup of an old object fails", async () => {
  const reported: unknown[] = [];
  const objectKey = "avatars/user-1/123e4567-e89b-42d3-a456-426614174000.webp";
  const response = await handleAvatarUpload(avatarRequest(), {
    authenticate: async () => "user-1",
    store: async () => ({ objectKey, publicUrl: `/api/avatars/${objectKey}` }),
    replaceReferences: async () => ["avatars/user-1/223e4567-e89b-42d3-a456-426614174000.webp"],
    remove: async () => { throw new Error("R2 cleanup failed"); },
    reportFailure: (error) => { reported.push(error); },
  });
  assert.equal(response.status, 201);
  assert.equal(reported.length, 1);
});

test("serves only allowlisted avatar keys with immutable image security headers", async () => {
  const key = "avatars/user-1/123e4567-e89b-42d3-a456-426614174000.webp";
  const invalid = await handleAvatarRead(["avatars", "user-1", "..", "secret"], async () => null);
  assert.equal(invalid.status, 404);

  const response = await handleAvatarRead(key.split("/"), async () => ({
    body: new Blob([webpSignature]).stream(),
    contentType: "image/webp",
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("hides unavailable avatar storage details from public read responses", async () => {
  const key = "avatars/user-1/123e4567-e89b-42d3-a456-426614174000.webp";
  const response = await handleAvatarRead(key.split("/"), async () => {
    throw new Error("AVATARS bucket missing: private-bucket-name");
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "头像暂时无法读取" });
});

test("application form lets applicants choose a nickname-initial default avatar", () => {
  assert.equal(getNicknameInitial(" 林同学 "), "林");
  assert.equal(getNicknameInitial(""), "你");
  const html = renderToStaticMarkup(createElement(ApplicationForm, { schools: [] }));
  assert.match(html, /type="file"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /aria-label="当前头像：你"/);
  assert.match(html, /aria-label="使用昵称首字头像"/);
  assert.doesNotMatch(html, /name="avatarKey"[^>]*type="text"/);
});
