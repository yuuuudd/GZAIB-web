import type { ConnectionNotificationEvent } from "./types";

export type ConnectionNotificationCopy = {
  userId: string;
  type: ConnectionNotificationEvent["type"];
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
};

const statusForType = {
  connection_received: "pending",
  connection_accepted: "accepted",
  connection_declined: "declined",
  connection_withdrawn: "withdrawn",
} as const;

/** Maps a connection event to allowlisted copy; contact cards and account data never enter this boundary. */
export function toConnectionNotification(event: ConnectionNotificationEvent): ConnectionNotificationCopy {
  const dedupeKey = `connection:${event.requestId}:${statusForType[event.type]}`;
  switch (event.type) {
    case "connection_received":
      return {
        userId: event.userId, type: event.type, title: "你收到一条新的连接请求",
        body: `${event.peerName}想和你聊聊：${event.topic}`,
        href: "/me/connections?box=received", dedupeKey,
      };
    case "connection_accepted":
      return {
        userId: event.userId, type: event.type, title: "你的连接请求已被接受",
        body: `${event.peerName}接受了你的连接请求：${event.topic}`,
        href: "/me/connections?box=accepted", dedupeKey,
      };
    case "connection_declined":
      return {
        userId: event.userId, type: event.type, title: "你的连接请求未被接受",
        body: `${event.peerName}婉拒了你的连接请求`,
        href: "/me/connections?box=sent", dedupeKey,
      };
    case "connection_withdrawn":
      return {
        userId: event.userId, type: event.type, title: "一条连接请求已被撤回",
        body: `${event.peerName}撤回了连接请求`,
        href: "/me/connections?box=received", dedupeKey,
      };
  }
}
