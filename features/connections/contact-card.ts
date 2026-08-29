export type ContactCard = {
  wechat?: string;
  email?: string;
  otherLabel?: string;
  otherValue?: string;
};

export type StoredContactCard = { encryptedPayload: string; updatedAt: number };

export type ContactCardAccess = {
  accepted: boolean;
  blocked: boolean;
  viewerCanAccessContacts: boolean;
  ownerCanAccessContacts: boolean;
};

export type ContactCardRepository = {
  save(userId: string, encryptedPayload: string, updatedAt: number): Promise<void>;
  get(userId: string): Promise<StoredContactCard | undefined>;
  getAccess(viewerId: string, ownerId: string): Promise<ContactCardAccess>;
};

export class ContactCardValidationError extends Error {
  constructor(message = "Invalid contact card") {
    super(message);
    this.name = "ContactCardValidationError";
  }
}

/** One public error prevents corrupted ciphertext from becoming an oracle. */
export class ContactCardCryptoError extends Error {
  constructor() {
    super("Contact card unavailable");
    this.name = "ContactCardCryptoError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CONTACT_CARD_VERSION = "v1";
const CONTACT_CARD_AAD_PREFIX = "builder-map-contact-card:v1:";
const ALLOWED_FIELDS = new Set(["wechat", "email", "otherLabel", "otherValue"]);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!BASE64URL.test(value) || value.length % 4 === 1) throw new ContactCardCryptoError();
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const decoded = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    if (base64Url(decoded) !== value) throw new ContactCardCryptoError();
    return decoded;
  } catch {
    throw new ContactCardCryptoError();
  }
}

function requiredString(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new ContactCardValidationError();
  const normalized = value.trim();
  if (!normalized || normalized.length < min || normalized.length > max) throw new ContactCardValidationError();
  return normalized;
}

function optionalString(value: unknown, min: number, max: number): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, min, max);
}

/** Validates an allowlisted contact card before it can be encrypted or persisted. */
export function validateContactCard(input: unknown): ContactCard {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ContactCardValidationError();
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some((key) => !ALLOWED_FIELDS.has(key))) throw new ContactCardValidationError();

  const wechat = optionalString(values.wechat, 2, 64);
  const emailInput = optionalString(values.email, 3, 320);
  const email = emailInput?.toLowerCase();
  if (email && !EMAIL.test(email)) throw new ContactCardValidationError();
  const otherLabel = optionalString(values.otherLabel, 2, 20);
  const otherValue = optionalString(values.otherValue, 2, 100);
  if (Boolean(otherLabel) !== Boolean(otherValue)) throw new ContactCardValidationError();
  if (!wechat && !email && !otherValue) throw new ContactCardValidationError();
  return { ...(wechat ? { wechat } : {}), ...(email ? { email } : {}), ...(otherLabel ? { otherLabel } : {}), ...(otherValue ? { otherValue } : {}) };
}

/** Reads and validates the key only at the service boundary, never at module import. */
export function requireContactEncryptionKey(providedKey?: string, environment: Record<string, string | undefined> = process.env): Uint8Array {
  const encoded = providedKey ?? environment.CONTACT_ENCRYPTION_KEY;
  if (!encoded || !BASE64.test(encoded)) throw new Error("CONTACT_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  try {
    const decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    if (decoded.byteLength !== 32) throw new Error();
    return decoded;
  } catch {
    throw new Error("CONTACT_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  }
}

async function importAesKey(encodedKey?: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", requireContactEncryptionKey(encodedKey), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function additionalData(userId: string): Uint8Array {
  return encoder.encode(`${CONTACT_CARD_AAD_PREFIX}${userId}`);
}

export async function encryptContactCard(userId: string, input: unknown, encodedKey?: string): Promise<string> {
  const card = validateContactCard(input);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(userId), tagLength: 128 },
    await importAesKey(encodedKey),
    encoder.encode(JSON.stringify(card)),
  );
  return `${CONTACT_CARD_VERSION}.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptContactCard(userId: string, payload: string, encodedKey?: string): Promise<ContactCard> {
  try {
    const [version, encodedIv, encodedCiphertext, ...rest] = payload.split(".");
    if (version !== CONTACT_CARD_VERSION || !encodedIv || !encodedCiphertext || rest.length > 0) throw new ContactCardCryptoError();
    const iv = fromBase64Url(encodedIv);
    const ciphertext = fromBase64Url(encodedCiphertext);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 17) throw new ContactCardCryptoError();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: additionalData(userId), tagLength: 128 },
      await importAesKey(encodedKey),
      ciphertext,
    );
    return validateContactCard(JSON.parse(decoder.decode(plaintext)));
  } catch {
    throw new ContactCardCryptoError();
  }
}

export function createContactCardService(repository: ContactCardRepository, encodedKey?: string) {
  // Read configuration once the contact-card boundary is actually used; unrelated routes stay bootable without a key.
  requireContactEncryptionKey(encodedKey);
  return {
    async saveOwnCard(userId: string, input: unknown, now: number): Promise<void> {
      const encryptedPayload = await encryptContactCard(userId, input, encodedKey);
      await repository.save(userId, encryptedPayload, now);
    },
    async getOwnCard(userId: string): Promise<ContactCard | undefined> {
      const stored = await repository.get(userId);
      return stored ? decryptContactCard(userId, stored.encryptedPayload, encodedKey) : undefined;
    },
    async hasOwnCard(userId: string): Promise<boolean> {
      return Boolean(await repository.get(userId));
    },
    async getVisibleContactCard(viewerId: string, ownerId: string): Promise<ContactCard | undefined> {
      if (viewerId !== ownerId) {
        const access = await repository.getAccess(viewerId, ownerId);
        if (!access.accepted || access.blocked || !access.viewerCanAccessContacts || !access.ownerCanAccessContacts) return undefined;
      }
      const stored = await repository.get(ownerId);
      return stored ? decryptContactCard(ownerId, stored.encryptedPayload, encodedKey) : undefined;
    },
  };
}

type OwnContactCardService = ReturnType<typeof createContactCardService>;

/** Shared API boundary: the session subject is always the sole owner of this card. */
export function createOwnContactCardHandler(dependencies: {
  requireSession(request: Request): Promise<{ identity: { id: string } }>;
  service: OwnContactCardService;
  now(): number;
}) {
  const privateHeaders = { "Cache-Control": "private, no-store" };
  async function owner(request: Request): Promise<string | undefined> {
    try { return (await dependencies.requireSession(request)).identity.id; }
    catch { return undefined; }
  }
  return {
    async GET(request: Request): Promise<Response> {
      const userId = await owner(request);
      if (!userId) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
      try {
        // A generic fetch only reports configuration; a settings page deliberately opts into reveal.
        if (new URL(request.url).searchParams.get("reveal") !== "1") {
          return Response.json({ configured: await dependencies.service.hasOwnCard(userId) }, { headers: privateHeaders });
        }
        const card = await dependencies.service.getOwnCard(userId);
        return Response.json({ configured: Boolean(card), ...(card ? { card } : {}) }, { headers: privateHeaders });
      } catch {
        return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
      }
    },
    async PUT(request: Request): Promise<Response> {
      const userId = await owner(request);
      if (!userId) return Response.json({ error: "请先登录有效账号" }, { status: 401, headers: privateHeaders });
      let input: unknown;
      try { input = await request.json(); }
      catch { return Response.json({ error: "联系方式格式不正确" }, { status: 400, headers: privateHeaders }); }
      try {
        await dependencies.service.saveOwnCard(userId, input, dependencies.now());
        return Response.json({ configured: true }, { headers: privateHeaders });
      } catch (error) {
        if (error instanceof ContactCardValidationError) {
          return Response.json({ error: "请填写至少一种有效联系方式" }, { status: 400, headers: privateHeaders });
        }
        return Response.json({ error: "联系方式暂时不可用" }, { status: 503, headers: privateHeaders });
      }
    },
  };
}

/** Runtime entry point for future connection/profile routes; it always reads the owner's current encrypted value. */
export async function getVisibleContactCard(viewerId: string, ownerId: string): Promise<ContactCard | undefined> {
  const [{ getDb }, { createContactCardRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/contact-cards"),
  ]);
  return createContactCardService(createContactCardRepository(getDb())).getVisibleContactCard(viewerId, ownerId);
}
