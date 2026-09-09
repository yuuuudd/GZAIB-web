const catalogueUrl = "https://static-data.gaokao.cn/www/2.0/school/name.json";
let schools = new Map<string, string>();
let refreshAt = 0;
let refreshing: Promise<void> | undefined;

async function refreshCatalogue() {
  try {
    const response = await fetch(catalogueUrl, { signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!response.ok) throw new Error("School catalogue unavailable");
    const { data } = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid school catalogue");
    const next = new Map<string, string>();
    for (const school of data) {
      if (typeof school?.name === "string" && typeof school.school_id === "string" && /^\d{1,6}$/.test(school.school_id)) {
        next.set(school.name.normalize("NFKC").trim(), school.school_id);
      }
    }
    if (!next.size) throw new Error("Empty school catalogue");
    schools = next;
    refreshAt = Date.now() + 86_400_000;
  } catch {
    // Keep the last usable catalogue; retry after five minutes if the source is down.
    refreshAt = Date.now() + 300_000;
  }
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.normalize("NFKC").trim();
  if (!name || name.length > 100) return new Response(null, { status: 400 });
  if (Date.now() >= refreshAt) {
    refreshing ??= refreshCatalogue().finally(() => { refreshing = undefined; });
    await refreshing;
  }
  if (!schools.size) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  // Prefer an exact campus entry before falling back to the parent university.
  const baseName = name.replace(/\([^()]*(?:校区|校园|本部)[^()]*\)$/, "").trim();
  const id = schools.get(name) ?? schools.get(baseName);
  if (!id) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://static-data.gaokao.cn/upload/logo/${id}.jpg`,
      "Cache-Control": "public, max-age=86400",
      "Referrer-Policy": "no-referrer",
    },
  });
}
