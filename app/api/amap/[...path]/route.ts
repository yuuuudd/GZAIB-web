type ProxyOptions = {
  securityCode?: string;
  fetchImpl?: typeof fetch;
};

const OFFICIAL_AMAP_ORIGIN = "https://restapi.amap.com";
const ALLOWED_PROXY_PATHS = new Set(["_AMapService"]);
const FORWARDED_QUERY_KEYS = new Set(["platform", "logversion", "appname", "csid", "sdkversion", "key", "serviceName", "version", "callback"]);

function fixedUpstream(path: string[], requestUrl: URL, securityCode: string): URL | null {
  const normalized = path.join("/");
  if (!ALLOWED_PROXY_PATHS.has(normalized)) return null;
  const upstream = new URL(`/${normalized}`, OFFICIAL_AMAP_ORIGIN);
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
  const securityCode = options.securityCode ?? process.env.AMAP_SECURITY_JS_CODE;
  if (!securityCode) return Response.json({ error: "AMap proxy is not configured" }, { status: 503 });
  const upstream = fixedUpstream(path, new URL(request.url), securityCode);
  if (!upstream) return Response.json({ error: "Not found" }, { status: 404 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
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
