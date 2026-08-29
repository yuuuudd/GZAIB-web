import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  status: text("status", { enum: ["active", "hidden", "connection_suspended", "suspended", "deleted"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_users_email").on(t.email), index("idx_users_status").on(t.status)]);

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  campus: text("campus").notNull().default("主校区"),
  city: text("city").notNull(),
  longitude: integer("longitude_e6").notNull(),
  latitude: integer("latitude_e6").notNull(),
  coordinateStatus: text("coordinate_status", { enum: ["suggested", "confirmed"] }).notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_schools_name_campus").on(t.name, t.campus), index("idx_schools_city").on(t.city)]);

export const magicLinkTokens = sqliteTable("magic_link_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose", { enum: ["application", "member_login", "admin_login"] }).notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("ux_magic_link_token_hash").on(t.tokenHash), index("idx_magic_link_expiry").on(t.expiresAt)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (t) => [uniqueIndex("ux_sessions_token_hash").on(t.tokenHash), index("idx_sessions_user_expiry").on(t.userId, t.expiresAt)]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["draft", "pending", "changes_requested", "approved", "rejected", "withdrawn"] }).notNull(),
  nickname: text("nickname").notNull(),
  realName: text("real_name"),
  avatarKey: text("avatar_key"),
  schoolId: text("school_id").notNull().references(() => schools.id),
  major: text("major"),
  grade: text("grade"),
  intro: text("intro").notNull(),
  currentFocus: text("current_focus"),
  canOffer: text("can_offer"),
  wantsToMeet: text("wants_to_meet"),
  skillsJson: text("skills_json").notNull().default("[]"),
  interestsJson: text("interests_json").notNull().default("[]"),
  rolesJson: text("roles_json").notNull().default("[]"),
  workLinksJson: text("work_links_json").notNull().default("[]"),
  visibilityJson: text("visibility_json").notNull().default("{}"),
  consentVersion: text("consent_version").notNull(),
  consentAcceptedAt: integer("consent_accepted_at").notNull(),
  submittedAt: integer("submitted_at"),
  reviewedAt: integer("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewReason: text("review_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_applications_user").on(t.userId), index("idx_applications_status_submitted").on(t.status, t.submittedAt)]);

export const memberProfiles = sqliteTable("member_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  slug: text("slug").notNull(),
  nickname: text("nickname").notNull(),
  realName: text("real_name"),
  avatarKey: text("avatar_key"),
  schoolId: text("school_id").notNull().references(() => schools.id),
  major: text("major"),
  grade: text("grade"),
  intro: text("intro").notNull(),
  currentFocus: text("current_focus"),
  canOffer: text("can_offer"),
  wantsToMeet: text("wants_to_meet"),
  skillsJson: text("skills_json").notNull().default("[]"),
  interestsJson: text("interests_json").notNull().default("[]"),
  rolesJson: text("roles_json").notNull().default("[]"),
  workLinksJson: text("work_links_json").notNull().default("[]"),
  publishStatus: text("publish_status", { enum: ["unpublished", "published", "pending_school_review"] }).notNull(),
  verifiedBuilder: integer("verified_builder", { mode: "boolean" }).notNull().default(false),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_member_profiles_user").on(t.userId), uniqueIndex("ux_member_profiles_slug").on(t.slug), index("idx_member_profiles_publish_school").on(t.publishStatus, t.schoolId)]);

export const profileVisibility = sqliteTable("profile_visibility", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => memberProfiles.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  visibility: text("visibility", { enum: ["public", "members", "private"] }).notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_profile_visibility_field").on(t.profileId, t.fieldName)]);

export const contributions = sqliteTable("contributions", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => memberProfiles.id),
  activityKey: text("activity_key").notNull(),
  title: text("title").notNull(),
  activityDate: integer("activity_date").notNull(),
  role: text("role").notNull(),
  outcome: text("outcome").notNull(),
  publicSummary: text("public_summary").notNull(),
  visibility: text("visibility", { enum: ["public", "members", "private"] }).notNull().default("public"),
  status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull(),
  confirmedBy: text("confirmed_by").references(() => users.id),
  confirmedAt: integer("confirmed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_contributions_profile_status").on(t.profileId, t.status), index("idx_contributions_activity_status").on(t.activityKey, t.status)]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  deliveryStatus: text("delivery_status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_notifications_dedupe").on(t.dedupeKey), index("idx_notifications_user_read_created").on(t.userId, t.readAt, t.createdAt)]);

export const dailyMetrics = sqliteTable("daily_metrics", {
  metricDate: text("metric_date").notNull(),
  eventType: text("event_type", { enum: ["map_view", "profile_view", "map_to_profile"] }).notNull(),
  dimensionKey: text("dimension_key").notNull().default("all"),
  count: integer("count").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.metricDate, t.eventType, t.dimensionKey] })]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  diffJson: text("diff_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("idx_audit_target_created").on(t.targetType, t.targetId, t.createdAt)]);
