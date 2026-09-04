import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";

test("login and registration render accessible working forms without unavailable social-login controls", async () => {
  const login = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ return_to: "/admin", error: "invalid" }) }));
  assert.match(login, /action="\/api\/auth\/login"/);
  assert.match(login, /type="email"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /name="returnTo" value="\/admin"/);
  assert.match(login, /邮箱或密码错误/);
  assert.match(login, /href="\/register\?return_to=%2Fadmin"/);
  assert.doesNotMatch(login, /微信|找回密码/);

  const register = renderToStaticMarkup(await RegisterPage({ searchParams: Promise.resolve({ return_to: "//evil.test" }) }));
  assert.match(register, /action="\/api\/auth\/register"/);
  assert.match(register, /autoComplete="new-password"/);
  assert.match(register, /minLength="12"/);
  assert.match(register, /name="returnTo" value="\/me"/);
  assert.match(register, /href="\/login\?return_to=%2Fme"/);
  assert.doesNotMatch(register, /微信|找回密码/);
});
