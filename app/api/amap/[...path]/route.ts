import { RequestBodyTooLargeError, readBoundedRequestBody } from "../../../../lib/bounded-body";

type ProxyOptions = {
  publicKey?: string;
  securityCode?: string;
  fetchImpl?: typeof fetch;
};

const OFFICIAL_AMAP_ORIGIN = "https://restapi.amap.com";
const ALLOWED_PROXY_PATHS = new Set(["_AMapService"]);
const FORWARDED_QUERY_KEYS = new Set(["platform", "logversion", "appname", "csid", "sdkversion", "key", "serviceName", "version", "callback"]);
const MAX_AMAP_POST_BYTES = 64 * 1024;

function fixedUpstream(path: string[], requestUrl: URL, securityCode: string): URL | null {
  const normalized = path.join("/");
  if (!ALLOWED_PROXY_PATHS.has(normalized)) return null;
  const upstream = new URL("/", OFFICIAL_AMAP_ORIGIN);
  for (const [key, value] of requestUrl.searchParams) {
    if (FORWARDED_QUERY_KEYS.has(key)) upstream.searchParams.append(key, value);
  }
  upstream.searchParams.set("jscode", securityCode);
  return upstream;
}

export async function handleAmapRequest(request: Request, path: string[], options: ProxyOptions = {}): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, POST" } });
  }
  if (path.join("/") === "config") {
    if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
    const publicKey = options.publicKey ?? process.env.NEXT_PUBLIC_AMAP_JS_KEY;
    if (!publicKey?.trim()) return Response.json({ error: "AMap is not configured" }, { status: 503 });
    return Response.json({ key: publicKey.trim() }, { headers: { "cache-control": "private, max-age=300" } });
  }
  if (!ALLOWED_PROXY_PATHS.has(path.join("/"))) return Response.json({ error: "Not found" }, { status: 404 });
  const securityCode = options.securityCode ?? process.env.AMAP_SECURITY_JS_CODE;
  if (!securityCode) return Response.json({ error: "AMap proxy is not configured" }, { status: 503 });
  const upstream = fixedUpstream(path, new URL(request.url), securityCode);
  if (!upstream) return Response.json({ error: "Not found" }, { status: 404 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = request.method === "POST" ? await readBoundedRequestBody(request, MAX_AMAP_POST_BYTES) : undefined;
    const response = await (options.fetchImpl ?? fetch)(upstream, {
      method: request.method,
      body,
      signal: controller.signal,
      headers: request.method === "POST" ? { "content-type": request.headers.get("content-type") ?? "application/x-www-form-urlencoded" } : undefined,
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request body too large" }, { status: 413 });
    const status = error instanceof DOMException && error.name === "AbortError" ? 504 : 502;
    return Response.json({ error: "AMap service unavailable" }, { status });
  } finally {
    clearTimeout(timeout);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  return handleAmapRequest(request, (await context.params).path);
}

export async function POST(request: Request, context: RouteContext) {
  return handleAmapRequest(request, (await context.params).path);
}
