const RESERVED_PATHS = new Set(["/login", "/register", "/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"]);

export function safeAccountReturnPath(value: unknown, fallback = "/me"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "https://site.local");
    if (url.origin !== "https://site.local" || RESERVED_PATHS.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function accountSignInPath(returnTo: string, authMode = process.env.AUTH_MODE): string {
  const safeReturnTo = safeAccountReturnPath(returnTo, "/");
  const path = authMode === "local" ? "/login" : "/signin-with-chatgpt";
  return `${path}?return_to=${encodeURIComponent(safeReturnTo)}`;
}
