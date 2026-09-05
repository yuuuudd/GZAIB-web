export type PasswordDigest = { salt: string; hash: string; iterations: number };

const DEFAULT_ITERATIONS = 600_000;
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normalizeLoginEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid email");
  const email = value.trim().normalize("NFKC").toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("Invalid email");
  return email;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid password");
  const length = Array.from(value).length;
  if (length < 6 || length > 128) throw new Error("Invalid password");
  return value;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(validatePassword(password)), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function hashPassword(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  iterations = DEFAULT_ITERATIONS,
): Promise<PasswordDigest> {
  if (!Number.isSafeInteger(iterations) || iterations < 1) throw new Error("Invalid password digest");
  return { salt: toBase64(salt), hash: toBase64(await derive(password, salt, iterations)), iterations };
}

export async function verifyPassword(password: string, digest: PasswordDigest): Promise<boolean> {
  try {
    if (!Number.isSafeInteger(digest.iterations) || digest.iterations < 1 || digest.iterations > 1_000_000) return false;
    const expected = fromBase64(digest.hash);
    const actual = await derive(password, fromBase64(digest.salt), digest.iterations);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}
