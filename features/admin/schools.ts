import type { AuditRecord } from "./authorization";
import { isAuthorizedAdminId } from "./identity";

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
  saveSuggestedAtomic(input: { school: SchoolCoordinateRecord; audit: AuditRecord }): Promise<SchoolCoordinateRecord>;
  confirmCoordinateAtomic(input: { schoolId: string; updatedAt: number; audit: AuditRecord }): Promise<{ transitioned: boolean }>;
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
      if (!isAuthorizedAdminId(adminId)) throw new Error("Forbidden");
      const parsed = parseSchoolAdminAction({ action: "propose", ...input });
      if (parsed.action !== "propose") throw new Error("Invalid school action");
      const coordinate = await geocode(parsed);
      if (!Number.isSafeInteger(coordinate.longitude) || !Number.isSafeInteger(coordinate.latitude)
        || Math.abs(coordinate.longitude) > 180_000_000 || Math.abs(coordinate.latitude) > 90_000_000) {
        throw new Error("Invalid geocoded coordinate");
      }
      const school = {
        id: createSchoolId(), name: parsed.name, campus: parsed.campus, city: parsed.city,
        ...coordinate, coordinateStatus: "suggested" as const, createdAt: now, updatedAt: now,
      };
      return repository.saveSuggestedAtomic({
        school,
        audit: {
          id: createAuditId(), actorUserId: adminId, targetType: "school", targetId: school.id,
          action: "school.coordinate_suggested",
          diffJson: JSON.stringify({ coordinateStatus: "suggested", source: "server_geocode" }),
          createdAt: now,
        },
      });
    },
    async confirmSchoolCoordinate(adminId: string, schoolId: string, now: number) {
      if (!isAuthorizedAdminId(adminId)) throw new Error("Forbidden");
      if (!validText(schoolId, 1, 160)) throw new Error("Invalid school action");
      const transition = await repository.confirmCoordinateAtomic({
        schoolId,
        updatedAt: now,
        audit: {
          id: createAuditId(), actorUserId: adminId, targetType: "school", targetId: schoolId,
          action: "school.coordinate_confirmed", diffJson: JSON.stringify({ coordinateStatus: "confirmed" }), createdAt: now,
        },
      });
      if (!transition.transitioned) throw new Error("School coordinate state changed before commit");
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
  const [{ getDb }, schema, drizzle] = await Promise.all([import("../../db"), import("../../db/schema"), import("drizzle-orm")]);
  const db = getDb();
  const repository: SchoolAdminRepository = {
    async saveSuggestedAtomic(input) {
      const save = db.insert(schema.schools).values(input.school).onConflictDoUpdate({
        target: [schema.schools.name, schema.schools.campus],
        set: {
          city: input.school.city, longitude: input.school.longitude, latitude: input.school.latitude,
          coordinateStatus: "suggested", updatedAt: input.school.updatedAt,
        },
      });
      const audit = db.insert(schema.auditLogs).select(drizzle.sql`
        select ${input.audit.id}, ${input.audit.actorUserId}, ${input.audit.targetType},
          (select ${schema.schools.id} from ${schema.schools}
            where ${schema.schools.name} = ${input.school.name} and ${schema.schools.campus} = ${input.school.campus}),
          ${input.audit.action}, ${input.audit.diffJson}, ${input.audit.createdAt}
      `);
      await db.batch([save, audit]);
      const [saved] = await db.select().from(schema.schools).where(drizzle.and(
        drizzle.eq(schema.schools.name, input.school.name),
        drizzle.eq(schema.schools.campus, input.school.campus),
      ));
      if (!saved) throw new Error("Unable to save school coordinate");
      return saved;
    },
    async confirmCoordinateAtomic(input) {
      const gateAudit = db.insert(schema.auditLogs).select(drizzle.sql`
        select ${input.audit.id}, ${input.audit.actorUserId}, ${input.audit.targetType}, ${input.audit.targetId},
          ${input.audit.action}, ${input.audit.diffJson}, ${input.audit.createdAt}
        from ${schema.schools}
        where ${schema.schools.id} = ${input.schoolId} and ${schema.schools.coordinateStatus} = 'suggested'
      `);
      const auditExists = drizzle.sql`exists (select 1 from ${schema.auditLogs} where ${schema.auditLogs.id} = ${input.audit.id})`;
      const results = await db.batch([
        gateAudit,
        db.update(schema.schools).set({ coordinateStatus: "confirmed", updatedAt: input.updatedAt }).where(drizzle.and(
          drizzle.eq(schema.schools.id, input.schoolId),
          drizzle.eq(schema.schools.coordinateStatus, "suggested"),
          auditExists,
        )),
      ]);
      const gateResult = results[0] as { meta?: { changes?: number } };
      return { transitioned: (gateResult.meta?.changes ?? 0) === 1 };
    },
  };
  return createSchoolAdminService(repository, geocodeSchool);
}
