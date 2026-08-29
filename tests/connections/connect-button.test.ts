import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
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
