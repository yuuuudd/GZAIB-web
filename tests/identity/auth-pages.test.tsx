import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";

test("login and registration render accessible working forms without unavailable social-login controls", async () => {
  const login = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ return_to: "/admin", error: "invalid" }) }));
  assert.match(login, /action="\/api\/auth\/login"/);
  assert.match(login, /type="email"/);
  assert.match(login, /autoComplete="current-password"/);
  const loginPassword = new JSDOM(login).window.document.querySelector<HTMLInputElement>('input[name="password"]')!;
  assert.equal(loginPassword.minLength, 6);
  assert.equal(loginPassword.maxLength, 128);
  assert.match(login, /name="returnTo" value="\/admin"/);
  assert.match(login, /邮箱或密码错误/);
  assert.match(login, /href="\/register\?return_to=%2Fadmin"/);
  assert.doesNotMatch(login, /微信|找回密码/);

  const register = renderToStaticMarkup(await RegisterPage({ searchParams: Promise.resolve({ return_to: "//evil.test" }) }));
  assert.match(register, /action="\/api\/auth\/register"/);
  assert.match(register, /autoComplete="new-password"/);
  const registerDocument = new JSDOM(register).window.document;
  for (const name of ["password", "confirmPassword"]) {
    const input = registerDocument.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    assert.equal(input.minLength, 6);
    assert.equal(input.maxLength, 18);
  }
  assert.match(register, /name="returnTo" value="\/me"/);
  assert.match(register, /href="\/login\?return_to=%2Fme"/);
  assert.doesNotMatch(register, /微信|找回密码/);
});

test("registration password visibility controls reveal each password independently", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/register" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.querySelector("#root")!);
  await act(async () => root.render(await RegisterPage({ searchParams: Promise.resolve({}) })));
  const password = document.querySelector('input[name="password"]') as HTMLInputElement;
  const confirmation = document.querySelector('input[name="confirmPassword"]') as HTMLInputElement;
  const controls = [...document.querySelectorAll<HTMLButtonElement>('button[type="button"]')];
  assert.equal(password.type, "password");
  assert.equal(confirmation.type, "password");
  await act(async () => controls[0]?.click());
  assert.equal(password.type, "text");
  assert.equal(confirmation.type, "password");
  await act(async () => controls[1]?.click());
  assert.equal(confirmation.type, "text");
  await act(async () => root.unmount());
  dom.window.close();
});
