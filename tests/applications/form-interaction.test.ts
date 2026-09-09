import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ApplicationForm } from "../../components/forms/ApplicationForm";
import { ProfileEditor } from "../../components/forms/ProfileEditor";

function imageCodec(t: TestContext, dom: JSDOM) {
  const originalImage = globalThis.Image;
  globalThis.Image = class {
    naturalWidth = 4000;
    naturalHeight = 3000;
    async decode() {}
  } as unknown as typeof Image;
  t.after(() => { globalThis.Image = originalImage; });
  t.mock.method(dom.window.HTMLCanvasElement.prototype, "getContext", () => ({ drawImage() {} }));
  t.mock.method(dom.window.HTMLCanvasElement.prototype, "toBlob", function (this: HTMLCanvasElement, callback: BlobCallback) {
    assert.equal(this.width, 512);
    assert.equal(this.height, 384);
    callback(new Blob([Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], { type: "image/webp" }));
  });
}

test("selecting multiple skill points keeps the application form mounted", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/apply" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.querySelector("#root")!);

  await act(async () => root.render(createElement(ApplicationForm, { schools: [] })));
  const skills = [...document.querySelectorAll<HTMLInputElement>('input[name="skills"]')];
  await act(async () => skills[0].click());
  await act(async () => skills[1].click());

  assert.equal(document.querySelectorAll('input[name="skills"]:checked').length, 2);
  assert.ok(document.querySelector('button[type="submit"]'));

  await act(async () => root.unmount());
  dom.window.close();
});

test("avatar upload keeps its server error visible instead of throwing a client-side reference error", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/apply" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
  imageCodec(t, dom);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "头像上传格式不正确" }), { status: 400, headers: { "content-type": "application/json" } });
  const root = createRoot(document.querySelector("#root")!);

  await act(async () => root.render(createElement(ApplicationForm, { schools: [] })));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new Blob(["avatar"], { type: "image/png" })] });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));

  assert.match(document.body.textContent ?? "", /头像上传格式不正确/);
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  dom.window.close();
});

test("both avatar forms compress gallery photos over five MiB before sending them and allow retry after decode failure", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/me" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
  imageCodec(t, dom);
  const sent: Blob[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    sent.push((init.body as FormData).get("avatar") as Blob);
    return Response.json({ objectKey: "avatars/user/photo.webp", publicUrl: "/api/avatars/avatars/user/photo.webp" }, { status: 201 });
  });
  const root = createRoot(document.querySelector("#root")!);
  try {
    for (const form of [
      createElement(ApplicationForm, { schools: [] }),
      createElement(ProfileEditor, { profile: { slug: "test", nickname: "测试" }, visibility: {}, schools: [], currentSchoolId: "", published: true }),
    ]) {
      await act(async () => root.render(form));
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      assert.equal(input.accept, "image/*");
      const file = new Blob([new Uint8Array(10 * 1024 * 1024)], { type: "image/jpeg" });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      assert.equal(sent.at(-1)?.type, "image/webp");
      assert.ok(sent.at(-1)!.size < file.size);
      assert.ok(document.querySelector('img[src="/api/avatars/avatars/user/photo.webp"]'));
      assert.equal(input.disabled, false);
      assert.equal(input.value, "");

      const count = sent.length;
      const decode = t.mock.method(Image.prototype, "decode", async () => { throw new Error("unsupported codec"); });
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      assert.equal(sent.length, count);
      assert.match(document.body.textContent ?? "", /无法读取.*JPG/);
      assert.equal(input.disabled, false);
      assert.ok(document.querySelector('img[src="/api/avatars/avatars/user/photo.webp"]'));
      decode.mock.restore();

      Object.defineProperty(input, "files", { value: [new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/jpeg" })] });
      await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      assert.equal(sent.length, count);
      assert.match(document.body.textContent ?? "", /10 MB 以内/);
      assert.equal(input.disabled, false);
    }
    assert.equal(sent.length, 2);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
