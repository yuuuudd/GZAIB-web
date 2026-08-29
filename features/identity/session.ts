import { requireDemoSessionSecret } from "../../lib/env";
import { resolveDemoIdentity } from "./demo-auth";
import type { DemoIdentityInput, Session } from "./types";

export const DEMO_SESSION_COOKIE = "demo_session";
export const DEMO_SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

type SessionPayload = {
  v: 1;
  sub: "demo-member" | "demo-admin";
  exp: number;
};

type CookieOptions = { production?: boolean };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid demo session");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

function sameSignature(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function sessionTokenFromCookie(cookie: string): string {
  if (!cookie) throw new Error("Invalid demo session");
  if (!cookie.includes("=")) return cookie;

  const pair = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${DEMO_SESSION_COOKIE}=`));
  if (!pair) throw new Error("Invalid demo session");
  return pair.slice(DEMO_SESSION_COOKIE.length + 1);
}

function identityInputFromSubject(subject: SessionPayload["sub"]): DemoIdentityInput {
  if (subject === "demo-member") return "member";
  if (subject === "demo-admin") return "admin";
  throw new Error("Invalid demo session");
}

function cookieParts(value: string, now: number, options: CookieOptions = {}): string[] {
  const parts = [
    `${DEMO_SESSION_COOKIE}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${DEMO_SESSION_TTL_MS / 1_000}`,
    `Expires=${new Date(now + DEMO_SESSION_TTL_MS).toUTCString()}`,
  ];
  if (options.production ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts;
}

/** Creates an opaque, versioned, signed session value with no client-controlled role claim. */
export async function createDemoSession(
  input: DemoIdentityInput,
  now: number = Date.now(),
  providedSecret?: string,
): Promise<string> {
  const identity = resolveDemoIdentity(input);
  const payload: SessionPayload = { v: 1, sub: identity.id, exp: now + DEMO_SESSION_TTL_MS };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload, requireDemoSessionSecret(providedSecret))}`;
}

export async function verifyDemoSession(
  cookie: string,
  now: number = Date.now(),
  providedSecret?: string,
): Promise<Session> {
  const token = sessionTokenFromCookie(cookie);
  const [encodedPayload, signature, ...remaining] = token.split(".");
  if (!encodedPayload || !signature || remaining.length > 0) throw new Error("Invalid demo session");

  const expectedSignature = await sign(encodedPayload, requireDemoSessionSecret(providedSecret));
  if (!sameSignature(signature, expectedSignature)) throw new Error("Invalid demo session");

  let payload: unknown;
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)));
  } catch {
    throw new Error("Invalid demo session");
  }

  if (!payload || typeof payload !== "object") throw new Error("Invalid demo session");
  const { v, sub, exp } = payload as Partial<SessionPayload>;
  if (v !== 1 || (sub !== "demo-member" && sub !== "demo-admin") || !Number.isSafeInteger(exp)) {
    throw new Error("Invalid demo session");
  }
  if (now > exp) throw new Error("Demo session expired");

  return { identity: resolveDemoIdentity(identityInputFromSubject(sub)), expiresAt: exp };
}

export function serializeDemoSessionCookie(value: string, now: number = Date.now(), options: CookieOptions = {}): string {
  return cookieParts(value, now, options).join("; ");
}

/** Shared request boundary for later application, profile, and admin services. */
export async function requireSession(
  request: Request,
  now: number = Date.now(),
  providedSecret?: string,
): Promise<Session> {
  return verifyDemoSession(request.headers.get("cookie") ?? "", now, providedSecret);
}

export function clearSession(response: Response, options: CookieOptions = {}): Response {
  const parts = [
    `${DEMO_SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (options.production ?? process.env.NODE_ENV === "production") parts.push("Secure");
  response.headers.append("Set-Cookie", parts.join("; "));
  return response;
}
