export class RequestBodyTooLargeError extends Error {
  constructor() { super("Request body exceeds the allowed size"); this.name = "RequestBodyTooLargeError"; }
}

function checkDeclaredLength(request: Request, maxBytes: number): void {
  const value = request.headers.get("content-length");
  if (value === null) return;
  if (!/^\d+$/u.test(value)) throw new RequestBodyTooLargeError();
  try {
    if (BigInt(value) > BigInt(maxBytes)) throw new RequestBodyTooLargeError();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new RequestBodyTooLargeError();
  }
}

/** Enforces the same body ceiling for declared, chunked, and forged request lengths. */
export async function readBoundedRequestBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  checkDeclaredLength(request, maxBytes);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new RequestBodyTooLargeError(); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export function requestFromBoundedBody(request: Request, body: Uint8Array): Request {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, { method: request.method, headers, body });
}
