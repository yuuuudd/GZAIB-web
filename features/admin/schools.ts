import type { AuditRecord } from "./authorization";

export type SchoolCoordinateRecord = {
  id: string;
  name: string;
  campus: string;
  city: string;
  longitude: number;
  latitude: number;
  coordinateStatus: "suggested" | "confirmed";
  createdAt: number;
  updatedAt: number;
};

export type SchoolAdminRepository = {
  saveSuggested(school: SchoolCoordinateRecord): Promise<SchoolCoordinateRecord>;
  confirmCoordinateAtomic(input: { schoolId: string; updatedAt: number; audit: AuditRecord }): Promise<void>;
};

export type SchoolAdminAction =
  | { action: "propose"; name: string; campus: string; city: string }
  | { action: "confirm"; schoolId: string };

function validText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export function parseSchoolAdminAction(value: unknown): SchoolAdminAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid school action");
  const record = value as Record<string, unknown>;
  if (record.action === "confirm" && Object.keys(record).length === 2 && validText(record.schoolId, 1, 160)) {
    return { action: "confirm", schoolId: record.schoolId.trim() };
  }
  if (record.action === "propose" && Object.keys(record).length === 4
    && validText(record.name, 2, 120) && validText(record.campus, 2, 120) && validText(record.city, 2, 80)) {
    return { action: "propose", name: record.name.trim(), campus: record.campus.trim(), city: record.city.trim() };
  }
  throw new Error("Invalid school action");
}

export function createSchoolAdminService(
  repository: SchoolAdminRepository,
  geocode: (query: { name: string; campus: string; city: string }) => Promise<{ longitude: number; latitude: number }>,
  createSchoolId: () => string = () => crypto.randomUUID(),
  createAuditId: () => string = () => crypto.randomUUID(),
) {
  return {
    async proposeSchool(adminId: string, input: Omit<Extract<SchoolAdminAction, { action: "propose" }>, "action">, now: number) {
      if (adminId !== "demo-admin") throw new Error("Forbidden");
      const parsed = parseSchoolAdminAction({ action: "propose", ...input });
      if (parsed.action !== "propose") throw new Error("Invalid school action");
      const coordinate = await geocode(parsed);
      if (!Number.isSafeInteger(coordinate.longitude) || !Number.isSafeInteger(coordinate.latitude)
        || Math.abs(coordinate.longitude) > 180_000_000 || Math.abs(coordinate.latitude) > 90_000_000) {
        throw new Error("Invalid geocoded coordinate");
      }
      return repository.saveSuggested({
        id: createSchoolId(), name: parsed.name, campus: parsed.campus, city: parsed.city,
        ...coordinate, coordinateStatus: "suggested", createdAt: now, updatedAt: now,
      });
    },
    async confirmSchoolCoordinate(adminId: string, schoolId: string, now: number) {
      if (adminId !== "demo-admin") throw new Error("Forbidden");
      if (!validText(schoolId, 1, 160)) throw new Error("Invalid school action");
      await repository.confirmCoordinateAtomic({
        schoolId,
        updatedAt: now,
        audit: {
          id: createAuditId(), actorUserId: adminId, targetType: "school", targetId: schoolId,
          action: "school.coordinate_confirmed", diffJson: JSON.stringify({ coordinateStatus: "confirmed" }), createdAt: now,
        },
      });
      return { schoolId, coordinateStatus: "confirmed" as const };
    },
  };
}

export async function geocodeSchool(
  query: { name: string; campus: string; city: string },
  fetchImpl: typeof fetch = fetch,
  key: string | undefined = process.env.AMAP_WEB_SERVICE_KEY,
): Promise<{ longitude: number; latitude: number }> {
  if (!key) throw new Error("AMap geocoding is not configured");
  const url = new URL("https://restapi.amap.com/v3/geocode/geo");
  url.searchParams.set("key", key);
  url.searchParams.set("address", `${query.name}${query.campus}`);
  url.searchParams.set("city", query.city);
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("AMap geocoding failed");
  const data = await response.json() as { status?: string; geocodes?: { location?: string }[] };
  const location = data.status === "1" ? data.geocodes?.[0]?.location : undefined;
  const [longitude, latitude] = location?.split(",").map(Number) ?? [];
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error("AMap geocoding returned no coordinate");
  return { longitude: Math.round(longitude! * 1_000_000), latitude: Math.round(latitude! * 1_000_000) };
}

export async function createRuntimeSchoolAdminService() {
  const [{ getDb }, schema, { and, eq }] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const db = getDb();
  const repository: SchoolAdminRepository = {
    async saveSuggested(school) {
      await db.insert(schema.schools).values(school).onConflictDoUpdate({
        target: [schema.schools.name, schema.schools.campus],
        set: { city: school.city, longitude: school.longitude, latitude: school.latitude, coordinateStatus: "suggested", updatedAt: school.updatedAt },
      });
      const [saved] = await db.select().from(schema.schools).where(and(eq(schema.schools.name, school.name), eq(schema.schools.campus, school.campus)));
      if (!saved) throw new Error("Unable to save school coordinate");
      return saved;
    },
    async confirmCoordinateAtomic(input) {
      const [school] = await db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.id, input.schoolId));
      if (!school) throw new Error("School not found");
      await db.batch([
        db.update(schema.schools).set({ coordinateStatus: "confirmed", updatedAt: input.updatedAt }).where(eq(schema.schools.id, input.schoolId)),
        db.insert(schema.auditLogs).values(input.audit),
      ]);
    },
  };
  return createSchoolAdminService(repository, geocodeSchool);
}
