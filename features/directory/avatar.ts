import type { AvatarStorageBindings } from "../../lib/r2";
import { RequestBodyTooLargeError, readBoundedRequestBody, requestFromBoundedBody } from "../../lib/bounded-body";

export const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_MULTIPART_BYTES = 6 * 1024 * 1024;
export const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable";

type AcceptedAvatarMime = "image/jpeg" | "image/png" | "image/webp";

export type AvatarValidationResult =
  | { ok: true; mimeType: AcceptedAvatarMime }
  | { ok: false; error: string };

type SyncAvatarCandidate = {
  type: string;
  size: number;
  bytes: Uint8Array;
};

type StoredAvatar = { objectKey: string; publicUrl: string };

type AvatarUploadDependencies = {
  authenticate(request: Request): Promise<string | null>;
  store(userId: string, file: Blob): Promise<StoredAvatar>;
  replaceReferences(userId: string, objectKey: string): Promise<string[]>;
  remove(objectKey: string): Promise<void>;
  reportFailure(error: unknown): void;
};

type AvatarObject = {
  body: BodyInit;
  contentType?: string;
};

const uuidV4Pattern = "[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const avatarKeyPattern = new RegExp(`^avatars/[A-Za-z0-9_-]{1,128}/${uuidV4Pattern}\\.webp$`);
const ownerPattern = /^[A-Za-z0-9_-]{1,128}$/;

function matches(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function detectedMime(bytes: Uint8Array): AcceptedAvatarMime | null {
  if (matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

function validateBytes(type: string, size: number, bytes: Uint8Array): AvatarValidationResult {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_AVATAR_SOURCE_BYTES) {
    return { ok: false, error: "头像文件须小于或等于 5 MB" };
  }
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
    return { ok: false, error: "仅支持 JPEG、PNG 或 WebP 头像" };
  }
  const signatureMime = detectedMime(bytes);
  if (!signatureMime || signatureMime !== type) return { ok: false, error: "头像文件内容与格式不匹配" };
  return { ok: true, mimeType: type };
}

export function validateAvatar(file: SyncAvatarCandidate): AvatarValidationResult;
export function validateAvatar(file: Blob): Promise<AvatarValidationResult>;
export function validateAvatar(file: SyncAvatarCandidate | Blob): AvatarValidationResult | Promise<AvatarValidationResult> {
  if (!(file instanceof Blob)) return validateBytes(file.type, file.size, file.bytes);
  return file.slice(0, 12).arrayBuffer().then((buffer) => validateBytes(file.type, file.size, new Uint8Array(buffer)));
}

export function createAvatarKey(userId: string, extension: "webp" = "webp"): string {
  if (extension !== "webp" || !ownerPattern.test(userId)) throw new Error("Invalid avatar owner");
  return `avatars/${userId}/${crypto.randomUUID()}.webp`;
}

export function isAvatarKey(value: string): boolean {
  return avatarKeyPattern.test(value);
}

export function isOwnedAvatarKey(value: string, userId: string): boolean {
  return ownerPattern.test(userId) && isAvatarKey(value) && value.startsWith(`avatars/${userId}/`);
}

export function getNicknameInitial(nickname: string): string {
  return Array.from(nickname.trim())[0] ?? "你";
}

export async function storeAvatar(
  userId: string,
  file: Blob,
  providedBindings?: AvatarStorageBindings,
): Promise<StoredAvatar> {
  const validation = await validateAvatar(file);
  if (!validation.ok) throw new AvatarInputError(validation.error);
  const bindings = providedBindings ?? (await import("../../lib/r2")).getAvatarStorageBindings();
  const objectKey = createAvatarKey(userId);
  const transformed = await bindings.images.input(file.stream()).transform({
    width: 1024,
    height: 1024,
    fit: "cover",
  }).output({ format: "image/webp", quality: 85 });
  const response = transformed.response();
  if (!response.ok || !response.body) throw new Error("Avatar image transform failed");
  await bindings.avatars.put(objectKey, response.body, {
    httpMetadata: { contentType: "image/webp", cacheControl: AVATAR_CACHE_CONTROL },
  });
  return { objectKey, publicUrl: `/api/avatars/${objectKey}` };
}

export class AvatarInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarInputError";
  }
}

function avatarFile(form: FormData): Blob | null {
  const files = [...form.entries()].filter((entry): entry is [string, File] => typeof entry[1] !== "string");
  return files.length === 1 && files[0]?.[0] === "avatar" ? files[0][1] : null;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function handleAvatarUpload(request: Request, dependencies: AvatarUploadDependencies): Promise<Response> {
  let userId: string | null;
  try {
    userId = await dependencies.authenticate(request);
  } catch {
    userId = null;
  }
  if (!userId) return jsonError("请先选择演示身份", 401);

  let file: Blob | null = null;
  try {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data;")) {
      return jsonError("头像上传格式不正确", 400);
    }
    const body = await readBoundedRequestBody(request, MAX_AVATAR_MULTIPART_BYTES);
    file = avatarFile(await requestFromBoundedBody(request, body).formData());
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return jsonError("头像文件过大", 413);
    return jsonError("头像上传格式不正确", 400);
  }
  if (!file) return jsonError("请选择一张头像", 400);
  const validation = await validateAvatar(file);
  if (!validation.ok) return jsonError(validation.error, 400);

  let stored: StoredAvatar;
  try {
    stored = await dependencies.store(userId, file);
  } catch (error) {
    if (error instanceof AvatarInputError) return jsonError(error.message, 400);
    dependencies.reportFailure(error);
    return jsonError("头像暂时无法上传", 500);
  }

  let oldKeys: string[];
  try {
    oldKeys = await dependencies.replaceReferences(userId, stored.objectKey);
  } catch (error) {
    dependencies.reportFailure(error);
    try {
      await dependencies.remove(stored.objectKey);
    } catch (cleanupError) {
      dependencies.reportFailure(cleanupError);
    }
    return jsonError("头像暂时无法上传", 500);
  }

  for (const oldKey of new Set(oldKeys)) {
    if (oldKey === stored.objectKey || !isOwnedAvatarKey(oldKey, userId)) continue;
    try {
      await dependencies.remove(oldKey);
    } catch (error) {
      dependencies.reportFailure(error);
    }
  }
  return Response.json(stored, { status: 201 });
}

export async function handleAvatarRead(
  path: string[],
  read: (objectKey: string) => Promise<AvatarObject | null>,
  reportFailure: (error: unknown) => void = () => undefined,
): Promise<Response> {
  const objectKey = path.join("/");
  if (!isAvatarKey(objectKey)) return jsonError("头像不存在", 404);
  try {
    const object = await read(objectKey);
    if (!object) return jsonError("头像不存在", 404);
    return new Response(object.body, {
      headers: {
        "content-type": object.contentType ?? "image/webp",
        "cache-control": AVATAR_CACHE_CONTROL,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    reportFailure(error);
    return jsonError("头像暂时无法读取", 500);
  }
}
