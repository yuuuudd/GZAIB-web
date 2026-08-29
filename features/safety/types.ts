export const REPORT_CATEGORIES = ["harassment", "spam", "false_identity", "privacy", "other"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export const REPORT_RESOLUTIONS = ["dismiss", "warn", "suspend_connections", "hide_profile", "suspend_account"] as const;
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];
export type SafetyReportStatus = "open" | "resolved" | "dismissed";

export type SafetyReport = {
  id: string; reporterId: string; targetUserId: string; category: ReportCategory; description: string;
  requestId?: string; status: SafetyReportStatus; resolution?: ReportResolution;
};

export type ReportInput = { targetUserId: string; category: ReportCategory; description: string; requestId?: string };
