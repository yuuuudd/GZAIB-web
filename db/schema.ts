import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  coordinateStatus: text("coordinate_status", { enum: ["suggested", "confirmed"] }).notNull().default("confirmed"),
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

export const passwordCredentials = sqliteTable("password_credentials", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  iterations: integer("iterations").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

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

export const activityProposals = sqliteTable("activity_proposals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  stage: text("stage", { enum: ["idea", "preparing", "scheduled"] }).notNull(),
  timeNote: text("time_note"),
  location: text("location"),
  supportNeeded: text("support_needed"),
  linksJson: text("links_json").notNull().default("[]"),
  status: text("status", { enum: ["pending", "changes_requested", "accepted", "declined"] }).notNull().default("pending"),
  submittedAt: integer("submitted_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_activity_proposals_user_submitted").on(t.userId, t.submittedAt), index("idx_activity_proposals_status_submitted").on(t.status, t.submittedAt)]);

export const coCreateProjects = sqliteTable("co_create_projects", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  type: text("type", { enum: ["活动协作", "项目共创", "内容共创", "校园连接", "技术支持", "资源协作"] }).notNull(),
  scope: text("scope", { enum: ["线上", "线下", "混合"] }).notNull(),
  recruitmentStatus: text("recruitment_status", { enum: ["招募中", "组队中", "想法征集"] }).notNull(),
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  problem: text("problem").notNull(),
  roles: text("roles").notNull(),
  effort: text("effort").notNull(),
  deadline: text("deadline"),
  level: text("level", { enum: ["新手友好", "需要经验"] }).notNull(),
  location: text("location"),
  locationTbd: integer("location_tbd", { mode: "boolean" }).notNull().default(true),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  timeTbd: integer("time_tbd", { mode: "boolean" }).notNull().default(true),
  publishStatus: text("publish_status", { enum: ["published", "archived"] }).notNull().default("published"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_co_create_public_updated").on(t.publishStatus, t.updatedAt), index("idx_co_create_owner_updated").on(t.ownerUserId, t.updatedAt)]);

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
  adminManaged: integer("admin_managed", { mode: "boolean" }).notNull().default(false),
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

export const contactCards = sqliteTable("contact_cards", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  encryptedPayload: text("encrypted_payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const connectionRequests = sqliteTable("connection_requests", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => users.id),
  recipientId: text("recipient_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  topic: text("topic").notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined", "withdrawn", "cancelled_by_block"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("idx_connection_sender_created").on(t.senderId, t.createdAt),
  index("idx_connection_recipient_status_created").on(t.recipientId, t.status, t.createdAt),
  index("idx_connection_pair_status").on(t.senderId, t.recipientId, t.status),
]);

export const blocks = sqliteTable("blocks", {
  blockerId: text("blocker_id").notNull().references(() => users.id),
  blockedId: text("blocked_id").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.blockerId, t.blockedId] }),
  index("idx_blocks_blocked").on(t.blockedId),
]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id),
  targetUserId: text("target_user_id").notNull().references(() => users.id),
  connectionRequestId: text("connection_request_id").references(() => connectionRequests.id),
  category: text("category", { enum: ["harassment", "spam", "false_identity", "privacy", "other"] }).notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
  resolution: text("resolution"),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by").references(() => users.id),
}, (t) => [index("idx_reports_status_created").on(t.status, t.createdAt)]);

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

export const communities = sqliteTable("communities", {
  id: text("id").primaryKey(), slug: text("slug").notNull(), name: text("name").notNull(), summary: text("summary").notNull(),
  primaryCity: text("primary_city"), locationMode: text("location_mode", { enum: ["city", "hybrid", "online"] }).notNull(),
  focusTagsJson: text("focus_tags_json").notNull().default("[]"), officialUrl: text("official_url").notNull(), sourceUrl: text("source_url").notNull(), sourceLabel: text("source_label").notNull(),
  publishStatus: text("publish_status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"), publishedAt: integer("published_at"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("ux_communities_slug").on(t.slug), index("idx_communities_status_city").on(t.publishStatus, t.primaryCity)]);

export const communityProfileSubmissions = sqliteTable("community_profile_submissions", {
  id: text("id").primaryKey(), communityId: text("community_id").references(() => communities.id), submitterUserId: text("submitter_user_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["create", "update"] }).notNull(), name: text("name").notNull(), summary: text("summary").notNull(), primaryCity: text("primary_city"), locationMode: text("location_mode", { enum: ["city", "hybrid", "online"] }).notNull(), focusTagsJson: text("focus_tags_json").notNull(), officialUrl: text("official_url").notNull(), sourceUrl: text("source_url").notNull(), sourceLabel: text("source_label").notNull(),
  status: text("status", { enum: ["pending", "changes_requested", "approved", "rejected"] }).notNull(), submittedAt: integer("submitted_at").notNull(), reviewedAt: integer("reviewed_at"), reviewedBy: text("reviewed_by").references(() => users.id), reviewReason: text("review_reason"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_community_submissions_status").on(t.status, t.submittedAt)]);

export const communityClaims = sqliteTable("community_claims", {
  id: text("id").primaryKey(), communityId: text("community_id").notNull().references(() => communities.id), applicantUserId: text("applicant_user_id").notNull().references(() => users.id), evidence: text("evidence").notNull(), evidenceUrl: text("evidence_url"), status: text("status", { enum: ["pending", "changes_requested", "approved", "rejected"] }).notNull(), submittedAt: integer("submitted_at").notNull(), reviewedAt: integer("reviewed_at"), reviewedBy: text("reviewed_by").references(() => users.id), reviewReason: text("review_reason"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("idx_community_claims_status").on(t.status, t.submittedAt),
  uniqueIndex("ux_community_claims_pending_applicant").on(t.applicantUserId, t.communityId).where(sql`${t.status} = 'pending'`),
]);

export const communityManagers = sqliteTable("community_managers", {
  communityId: text("community_id").notNull().references(() => communities.id), userId: text("user_id").notNull().references(() => users.id), role: text("role", { enum: ["owner", "editor"] }).notNull().default("owner"), createdAt: integer("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] }), index("idx_community_managers_user").on(t.userId)]);

export const communityUpdates = sqliteTable("community_updates", {
  id: text("id").primaryKey(), communityId: text("community_id").notNull().references(() => communities.id), submitterUserId: text("submitter_user_id").notNull().references(() => users.id), title: text("title").notNull(), summary: text("summary").notNull(), occurredAt: integer("occurred_at").notNull(), sourceUrl: text("source_url"), status: text("status", { enum: ["pending", "changes_requested", "published", "rejected", "archived"] }).notNull(), submittedAt: integer("submitted_at").notNull(), reviewedAt: integer("reviewed_at"), reviewedBy: text("reviewed_by").references(() => users.id), reviewReason: text("review_reason"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_community_updates_public").on(t.communityId, t.status, t.occurredAt)]);

export const communityFollows = sqliteTable("community_follows", {
  communityId: text("community_id").notNull().references(() => communities.id), userId: text("user_id").notNull().references(() => users.id), createdAt: integer("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] }), index("idx_community_follows_user").on(t.userId, t.createdAt)]);
