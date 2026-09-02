import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ApplicationForm } from "../../components/forms/ApplicationForm";

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

test("avatar upload keeps its server error visible instead of throwing a client-side reference error", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/apply" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
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
