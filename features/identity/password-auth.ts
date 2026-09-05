import { RequestBodyTooLargeError, readBoundedRequestBody } from "../../lib/bounded-body";
import { createDatabaseSession, serializeDatabaseSessionCookie } from "./database-session";
import { hashPassword, normalizeLoginEmail, validatePassword, verifyPassword, type PasswordDigest } from "./password";

const MAX_BODY_BYTES = 8 * 1024;
const headers = { "Cache-Control": "private, no-store" };

type Attempt = { failures: number; resetAt: number };

export function createAuthRateLimiter(maxFailures = 5, windowMs = 15 * 60 * 1_000) {
  const attempts = new Map<string, Attempt>();
  const current = (key: string, now: number) => {
    const attempt = attempts.get(key);
    if (attempt && attempt.resetAt > now) return attempt;
    attempts.delete(key);
    return undefined;
  };
  return {
    blocked(key: string, now: number) { return (current(key, now)?.failures ?? 0) >= maxFailures; },
    fail(key: string, now: number) {
      const attempt = current(key, now);
      attempts.set(key, attempt ? { ...attempt, failures: attempt.failures + 1 } : { failures: 1, resetAt: now + windowMs });
    },
    clear(key: string) { attempts.delete(key); },
  };
}

export type AuthRateLimiter = ReturnType<typeof createAuthRateLimiter>;

type PasswordAuthDependencies = {
  now(): number;
  register(email: string, password: string, now: number): Promise<string>;
  authenticate(email: string, password: string): Promise<string | null>;
  startSession(userId: string, now: number): Promise<{ token: string; cookie: string }>;
  limiter: AuthRateLimiter;
};

const runtimeLimiter = createAuthRateLimiter();

export function createPasswordAccountRecords(email: string, digest: PasswordDigest, now: number, id = `local:${crypto.randomUUID()}`) {
  return {
    user: { id, email, role: "member" as const, status: "active" as const, createdAt: now, updatedAt: now },
    credential: { userId: id, passwordHash: digest.hash, salt: digest.salt, iterations: digest.iterations, updatedAt: now },
  };
}

async function registerRuntime(email: string, password: string, now: number): Promise<string> {
  const records = createPasswordAccountRecords(email, await hashPassword(password), now);
  await (await import("../../lib/db/repositories/password-auth")).insertPasswordAccount(records);
  return records.user.id;
}

async function authenticateRuntime(email: string, password: string): Promise<string | null> {
  const account = await (await import("../../lib/db/repositories/password-auth")).loadRuntimePasswordAccount(email);
  return account && await verifyPassword(password, { hash: account.hash, salt: account.salt, iterations: account.iterations }) ? account.userId : null;
}

async function startRuntimeSession(userId: string, now: number) {
  const created = await createDatabaseSession(userId, now);
  await (await import("../../lib/db/repositories/password-auth")).insertPasswordSession(created.record);
  return { token: created.token, cookie: serializeDatabaseSessionCookie(created.token, now) };
}

const runtimeDependencies: PasswordAuthDependencies = {
  now: Date.now, register: registerRuntime, authenticate: authenticateRuntime, startSession: startRuntimeSession, limiter: runtimeLimiter,
};

function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim()
    || "unknown";
}

function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/me";
  try { return new URL(value, "https://site.local").origin === "https://site.local" ? value : "/me"; }
  catch { return "/me"; }
}

async function readInput(request: Request, registration = false): Promise<{ email: string; password: string; returnTo: string }> {
  const body = new TextDecoder().decode(await readBoundedRequestBody(request, MAX_BODY_BYTES));
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  let raw: unknown;
  if (contentType === "application/json") raw = JSON.parse(body);
  else if (contentType === "application/x-www-form-urlencoded") raw = Object.fromEntries(new URLSearchParams(body));
  else throw new Error("Invalid request");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid request");
  const input = raw as Record<string, unknown>;
  const allowedKeys = registration ? ["email", "password", "confirmPassword", "returnTo"] : ["email", "password", "returnTo"];
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) throw new Error("Invalid request");
  const password = validatePassword(input.password);
  if (registration && (Array.from(password).length > 18 || input.confirmPassword !== password)) throw new Error("Invalid password confirmation");
  return { email: normalizeLoginEmail(input.email), password, returnTo: safeReturnTo(input.returnTo) };
}

function isForm(request: Request): boolean {
  return request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ?? false;
}

function failure(request: Request, path: string, message: string, status: number): Response {
  if (!isForm(request)) return Response.json({ error: message }, { status, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: `${path}?error=invalid` } });
}

function success(request: Request, returnTo: string, cookie: string, status: number): Response {
  const response = isForm(request)
    ? new Response(null, { status: 303, headers: { ...headers, Location: returnTo } })
    : Response.json({ ok: true, returnTo }, { status, headers });
  response.headers.append("Set-Cookie", cookie);
  return response;
}

export async function handleRegistration(request: Request, dependencies: PasswordAuthDependencies = runtimeDependencies): Promise<Response> {
  const now = dependencies.now();
  const key = clientKey(request);
  if (dependencies.limiter.blocked(key, now)) return failure(request, "/register", "尝试次数过多，请稍后再试", 429);
  let input;
  try { input = await readInput(request, true); }
  catch (error) {
    dependencies.limiter.fail(key, now);
    return failure(request, "/register", "请检查邮箱和密码", error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  try {
    const userId = await dependencies.register(input.email, input.password, now);
    const session = await dependencies.startSession(userId, now);
    dependencies.limiter.clear(key);
    return success(request, "/apply", session.cookie, 201);
  } catch {
    dependencies.limiter.fail(key, now);
    return failure(request, "/register", "请检查邮箱和密码，或登录已有账号", 400);
  }
}

export async function handlePasswordLogin(request: Request, dependencies: PasswordAuthDependencies = runtimeDependencies): Promise<Response> {
  const now = dependencies.now();
  const key = clientKey(request);
  if (dependencies.limiter.blocked(key, now)) return failure(request, "/login", "尝试次数过多，请稍后再试", 429);
  let input;
  try { input = await readInput(request); }
  catch (error) {
    dependencies.limiter.fail(key, now);
    return failure(request, "/login", "邮箱或密码错误", error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const userId = await dependencies.authenticate(input.email, input.password).catch(() => null);
  if (!userId) {
    dependencies.limiter.fail(key, now);
    return failure(request, "/login", "邮箱或密码错误", 401);
  }
  const session = await dependencies.startSession(userId, now);
  dependencies.limiter.clear(key);
  return success(request, input.returnTo, session.cookie, 200);
}
