import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nextDialogFocusIndex, shouldCloseConnectionDialog } from "../../components/connections/dialog-focus";
import { ConnectionRequestDialog } from "../../components/connections/ConnectionRequestDialog";

test("dialog focus wraps on Tab and Shift+Tab", () => {
  assert.equal(nextDialogFocusIndex(2, 3, false), 0);
  assert.equal(nextDialogFocusIndex(0, 3, true), 2);
  assert.equal(nextDialogFocusIndex(1, 3, false), 2);
});

test("only Escape requests a dialog close", () => {
  assert.equal(shouldCloseConnectionDialog("Escape"), true);
  assert.equal(shouldCloseConnectionDialog("Enter"), false);
});

test("dialog keeps its modal labels and an explicit close control while focus behavior stays local", () => {
  const html = renderToStaticMarkup(createElement(ConnectionRequestDialog, { recipientSlug: "peer", recipientName: "共建者 B", dailyRemaining: 3, onClose: () => undefined, onCreated: () => undefined }));
  assert.match(html, /填写时 10～100 字/);
  assert.match(html, /minlength="10"/i);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /关闭连接请求对话框/);
  assert.match(html, /连接-dialog-title|connection-dialog-title/);
});
