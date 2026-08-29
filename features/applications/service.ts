import type { ApplicationRepository } from "../../lib/db/repositories/applications";
import type { ApplicationInput, ApplicationRecord } from "./types";
import { CONSENT_VERSION, validateApplication } from "./validation";

export class ApplicationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationServiceError";
  }
}

export type ApplicationService = {
  submitApplication(userId: string, input: unknown, now: number): Promise<ApplicationRecord>;
  getApplicationStatus(userId: string): Promise<ApplicationRecord | undefined>;
  withdrawApplication(userId: string, now: number): Promise<ApplicationRecord>;
};

/** Keeps state transitions at the server boundary and makes the D1 repository replaceable in tests. */
export function createApplicationService(
  repository: ApplicationRepository,
  createId: () => string = () => crypto.randomUUID(),
): ApplicationService {
  async function submitApplication(userId: string, rawInput: unknown, now: number): Promise<ApplicationRecord> {
    const validated = validateApplication(rawInput);
    if (!validated.ok) throw new ApplicationServiceError(validated.errors[0] ?? "申请资料不正确");
    if (!await repository.isSchoolConfirmed(validated.value.schoolId)) {
      throw new ApplicationServiceError("请选择已确认坐标的学校或校区");
    }

    const existing = await repository.getApplicationByUserId(userId);
    if (existing && existing.status !== "draft" && existing.status !== "changes_requested") {
      throw new ApplicationServiceError("当前申请暂不能再次提交");
    }

    const { consentAccepted: _consentAccepted, ...applicationInput } = validated.value;
    const record: ApplicationRecord = {
      ...applicationInput,
      id: existing?.id ?? createId(),
      userId,
      status: "pending",
      consentVersion: CONSENT_VERSION,
      consentAcceptedAt: now,
      submittedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await repository.saveApplication(record);
    return record;
  }

  async function getApplicationStatus(userId: string): Promise<ApplicationRecord | undefined> {
    return repository.getApplicationByUserId(userId);
  }

  async function withdrawApplication(userId: string, now: number): Promise<ApplicationRecord> {
    const existing = await repository.getApplicationByUserId(userId);
    if (!existing || existing.status !== "pending") throw new ApplicationServiceError("只有审核中的申请可以撤回");
    const withdrawn = { ...existing, status: "withdrawn" as const, updatedAt: now };
    await repository.saveApplication(withdrawn);
    return withdrawn;
  }

  return { submitApplication, getApplicationStatus, withdrawApplication };
}

/** Runtime adapter for request handlers; tests use createApplicationService with an in-memory repository. */
export async function submitApplication(userId: string, input: unknown, now: number): Promise<ApplicationRecord> {
  return (await runtimeService()).submitApplication(userId, input, now);
}

export async function getApplicationStatus(userId: string): Promise<ApplicationRecord | undefined> {
  return (await runtimeService()).getApplicationStatus(userId);
}

async function runtimeService(): Promise<ApplicationService> {
  const [{ getDb }, { createApplicationRepository }] = await Promise.all([
    import("../../db"), import("../../lib/db/repositories/applications"),
  ]);
  return createApplicationService(createApplicationRepository(getDb()));
}

/** Re-exports the request shape at the feature boundary for form and route callers. */
export type { ApplicationInput };
