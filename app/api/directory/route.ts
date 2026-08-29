import { createRuntimeDirectoryService, type DirectoryQuery } from "../../../features/directory/service";

function list(value: string | null): string[] | undefined {
  const values = value?.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  return values?.length ? values : undefined;
}

function directoryQuery(url: URL): DirectoryQuery {
  const verified = url.searchParams.get("verified");
  return {
    ...(url.searchParams.get("city") ? { city: url.searchParams.get("city")!.slice(0, 80) } : {}),
    ...(url.searchParams.get("schoolId") ? { schoolId: url.searchParams.get("schoolId")!.slice(0, 120) } : {}),
    ...(list(url.searchParams.get("skills")) ? { skills: list(url.searchParams.get("skills")) } : {}),
    ...(list(url.searchParams.get("roles")) ? { roles: list(url.searchParams.get("roles")) } : {}),
    ...(verified === "true" || verified === "false" ? { verified: verified === "true" } : {}),
    ...(url.searchParams.get("q") ? { q: url.searchParams.get("q")!.slice(0, 100) } : {}),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const service = await createRuntimeDirectoryService();
    if (url.searchParams.get("mode") === "list") {
      const rawLimit = Number(url.searchParams.get("limit") ?? 24);
      const limit = Number.isInteger(rawLimit) ? rawLimit : 24;
      return Response.json(await service.listMembers(directoryQuery(url), {
        limit,
        ...(url.searchParams.get("cursor") ? { cursor: url.searchParams.get("cursor")!.slice(0, 160) } : {}),
      }));
    }
    return Response.json({ schools: await service.list(directoryQuery(url)) });
  } catch (error) {
    console.error("Unable to load public directory", error);
    return Response.json({ error: "学校目录暂时无法读取" }, { status: 503 });
  }
}
