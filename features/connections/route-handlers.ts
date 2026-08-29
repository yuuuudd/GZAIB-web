import { ConnectionServiceError, createRuntimeConnectionService } from "./service";
import type { ConnectionAction, ConnectionBox, ConnectionCursor, ConnectionRequest } from "./types";

type ActiveSession = { identity: { id: string; role?: string } };
type ContactCard = { wechat?: string; email?: string; otherLabel?: string; otherValue?: string };
type ConnectionService = Pick<Awaited<ReturnType<typeof createRuntimeConnectionService>>, "createRequest" | "resolveRequest" | "listInbox">;

const privateHeaders = { "Cache-Control": "private, no-store" };
const boxes = new Set<ConnectionBox>(["received", "sent", "accepted"]);
const actions = new Set<ConnectionAction>(["accept", "decline", "withdraw"]);

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function error(status: number, message: string) {
  return response({ error: message }, status);
}

function publicRequest(request: ConnectionRequest) {
  return {
    id: request.id,
    topic: request.topic,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.resolvedAt === undefined ? {} : { resolvedAt: request.resolvedAt }),
  };
}

function counterpartId(request: ConnectionRequest, actorId: string) {
  return request.senderId === actorId ? request.recipientId : request.senderId;
}

function encodeCursor(cursor: ConnectionCursor | undefined) {
  if (!cursor) return undefined;
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCursor(value: string | null): ConnectionCursor | undefined {
  if (value === null) return undefined;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new Error("invalid cursor");
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<ConnectionCursor>;
    if (!Number.isSafeInteger(parsed.createdAt) || parsed.createdAt < 0 || typeof parsed.id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(parsed.id)) throw new Error("invalid cursor");
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error("invalid cursor");
  }
}

async function jsonObject(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as Record<string, unknown>;
  } catch {
    throw new Error("invalid");
  }
}

function mapServiceError(cause: unknown) {
  if (!(cause instanceof ConnectionServiceError)) return undefined;
  switch (cause.code) {
    case "sender_ineligible": return error(403, "当前账号不能发起连接");
    case "recipient_unavailable":
    case "not_found": return error(404, "该成员暂不可连接");
    case "blocked":
    case "forbidden": return error(403, "无权执行此操作");
    case "duplicate_pending": return error(409, "已存在待处理的连接请求");
    case "daily_limit": return error(429, "今日连接请求已达上限");
    case "state_conflict": return error(409, "请求状态已发生变化");
    default: return error(400, "连接请求内容不符合要求");
  }
}

/** HTTP boundary: session identity and recipient resolution remain server-owned. */
export function createConnectionRouteHandlers(dependencies: {
  requireActiveSession(request: Request): Promise<ActiveSession>;
  createService(): ConnectionService | Promise<ConnectionService>;
  resolveRecipientId(publicSlug: string): Promise<string | undefined>;
  resolvePublicSlug?(userId: string): Promise<string | undefined>;
  getVisibleContactCard(viewerId: string, ownerId: string): Promise<ContactCard | undefined>;
  now(): number;
}) {
  async function sessionFor(request: Request) {
    try { return await dependencies.requireActiveSession(request); }
    catch { return undefined; }
  }

  async function toItem(actorId: string, request: ConnectionRequest) {
    const unlockedContactCard = request.status === "accepted"
      ? await dependencies.getVisibleContactCard(actorId, counterpartId(request, actorId))
      : undefined;
    const counterpartSlug = await dependencies.resolvePublicSlug?.(counterpartId(request, actorId));
    return { request: publicRequest(request), ...(counterpartSlug ? { counterpartSlug } : {}), ...(unlockedContactCard ? { unlockedContactCard } : {}) };
  }

  return {
    async POST(request: Request) {
      const session = await sessionFor(request);
      if (!session) return error(401, "请先登录有效账号");
      let body: Record<string, unknown>;
      try { body = await jsonObject(request); } catch { return error(400, "连接请求内容不符合要求"); }
      if (Object.keys(body).some((key) => !["recipientId", "topic", "message", "senderId"].includes(key))
        || typeof body.recipientId !== "string" || typeof body.topic !== "string" || typeof body.message !== "string") {
        return error(400, "连接请求内容不符合要求");
      }
      const recipientId = await dependencies.resolveRecipientId(body.recipientId);
      if (!recipientId) return error(404, "该成员暂不可连接");
      try {
        const created = await (await dependencies.createService()).createRequest(session.identity.id, { recipientId, topic: body.topic, message: body.message }, dependencies.now());
        return response({ request: publicRequest(created) }, 201);
      } catch (cause) {
        return mapServiceError(cause) ?? error(503, "连接服务暂时不可用");
      }
    },

    async GET(request: Request) {
      const session = await sessionFor(request);
      if (!session) return error(401, "请先登录有效账号");
      const url = new URL(request.url);
      const box = url.searchParams.get("box");
      if (!box || !boxes.has(box as ConnectionBox)) return error(400, "收件箱参数无效");
      let cursor: ConnectionCursor | undefined;
      try { cursor = decodeCursor(url.searchParams.get("cursor")); } catch { return error(400, "分页参数无效"); }
      try {
        const page = await (await dependencies.createService()).listInbox(session.identity.id, box as ConnectionBox, cursor);
        return response({ items: await Promise.all(page.items.map((item) => toItem(session.identity.id, item))), nextCursor: encodeCursor(page.nextCursor) });
      } catch {
        return error(503, "连接服务暂时不可用");
      }
    },

    async PATCH(request: Request, context?: { params: Promise<{ id: string }> | { id: string } }) {
      const session = await sessionFor(request);
      if (!session) return error(401, "请先登录有效账号");
      const id = context ? (await context.params).id : new URL(request.url).pathname.split("/").at(-1) ?? "";
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return error(404, "该连接请求不可用");
      let body: Record<string, unknown>;
      try { body = await jsonObject(request); } catch { return error(400, "操作参数无效"); }
      if (Object.keys(body).length !== 1 || !actions.has(body.action as ConnectionAction)) return error(400, "操作参数无效");
      try {
        const updated = await (await dependencies.createService()).resolveRequest(session.identity.id, id, body.action as ConnectionAction, dependencies.now());
        return response(await toItem(session.identity.id, updated));
      } catch (cause) {
        return mapServiceError(cause) ?? error(503, "连接服务暂时不可用");
      }
    },
  };
}
