function singleHeaderValue(value: string | null): string | undefined {
  if (value === null || value.includes(",")) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isLoopbackHostname(host: string): boolean {
  const value = host.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

export function configuredAppOrigin(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const origin = new URL(value);
    if ((origin.protocol !== "https:" && origin.protocol !== "http:")
      || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
      || isLoopbackHostname(origin.hostname)) return undefined;
    return origin;
  } catch {
    return undefined;
  }
}

/** Uses deployment configuration for public metadata; a direct loopback Host is the sole local fallback. */
export function canonicalMetadataOrigin(requestHeaders: Headers, appOrigin = process.env.APP_ORIGIN): URL | undefined {
  const configured = configuredAppOrigin(appOrigin);
  if (configured) return configured;
  const host = singleHeaderValue(requestHeaders.get("host"));
  if (!host) return undefined;
  try {
    const origin = new URL(`http://${host}`);
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || !isLoopbackHostname(origin.hostname)) return undefined;
    return origin;
  } catch {
    return undefined;
  }
}
