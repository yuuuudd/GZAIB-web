import { toConnectionNotification } from "./connection-events";
import type { ConnectionNotificationEvent, NotificationSender } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8_000;

export type ConnectionEmail = { to: string; event: ConnectionNotificationEvent };
export type ConnectionEmailSender = NotificationSender<ConnectionEmail>;

type ResendConfiguration = {
  apiKey?: string;
  from?: string;
  siteUrl?: string;
  fetch?: typeof globalThis.fetch;
};

function configured(configuration: ResendConfiguration): configuration is Required<Pick<ResendConfiguration, "apiKey" | "from" | "siteUrl">> & ResendConfiguration {
  try {
    const origin = new URL(configuration.siteUrl ?? "");
    const from = configuration.from?.trim() ?? "";
    return Boolean(
      configuration.apiKey?.trim()
      && from.includes("@")
      && !/[\r\n]/.test(from)
      && origin.protocol === "https:"
      && origin.hostname,
    );
  } catch {
    return false;
  }
}

/** Optional Resend adapter. Invalid or absent Demo configuration intentionally means no outbound delivery. */
export function createResendConnectionEmailSender(configuration: ResendConfiguration): ConnectionEmailSender | undefined {
  if (!configured(configuration)) return undefined;
  const requestFetch = configuration.fetch ?? globalThis.fetch;
  if (!requestFetch) return undefined;

  return {
    async send({ to, event }): Promise<DeliveryResult> {
      const copy = toConnectionNotification(event);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await requestFetch(new Request(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${configuration.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: configuration.from,
            to: [to],
            subject: copy.title,
            text: `${copy.body}\n\n请登录本站查看：${new URL(copy.href, configuration.siteUrl).toString()}`,
          }),
          signal: controller.signal,
        }));
        return response.ok ? { status: "sent" } : { status: "failed", reason: `resend_status_${response.status}` };
      } catch {
        return { status: "failed", reason: "resend_request_failed" };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
