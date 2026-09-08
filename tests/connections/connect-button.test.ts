import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
// @ts-expect-error The project intentionally runs jsdom without the optional @types/jsdom package.
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectButton, connectionCreatedUiState } from "../../components/connections/ConnectButton";

test("successful creation moves the CTA to a stable focusable status target", () => {
  assert.deepEqual(connectionCreatedUiState(), { ctaState: "pending", focusTarget: "status" });

  const html = renderToStaticMarkup(createElement(ConnectButton, {
    state: "pending",
    recipientSlug: "peer",
    recipientName: "共建者 B",
    dailyRemaining: 3,
  }));
  assert.match(html, /role="status"/);
  assert.match(html, /tabindex="-1"/i);
  assert.match(html, /等待对方回应/);
});

test("CTA follows an eligibility result loaded after the card mounts", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  const props = { recipientSlug: "peer", recipientName: "共建者 B", dailyRemaining: 5 };

  await act(async () => root.render(createElement(ConnectButton, { ...props, state: "unavailable" })));
  assert.equal(document.querySelector(".connection-cta"), null);
  await act(async () => root.render(createElement(ConnectButton, { ...props, state: "eligible" })));
  assert.match(document.querySelector(".connection-cta")?.textContent ?? "", /发起|想认识/);

  await act(async () => root.unmount());
  dom.window.close();
});

test("a project connection request keeps the project title in its dialog", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test" });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(createElement(ConnectButton, { state: "eligible", recipientSlug: "peer", recipientName: "发起人", dailyRemaining: 5, label: "申请加入", topic: "校园知识库 AI 原型小组" })));
  await act(async () => document.querySelector<HTMLButtonElement>(".connection-cta")?.click());
  assert.match(document.querySelector('[role="dialog"]')?.textContent ?? "", /校园知识库 AI 原型小组/);
  await act(async () => root.unmount());
  dom.window.close();
});
