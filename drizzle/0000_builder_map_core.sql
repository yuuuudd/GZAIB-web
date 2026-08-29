CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`nickname` text NOT NULL,
	`real_name` text,
	`avatar_key` text,
	`school_id` text NOT NULL,
	`major` text,
	`grade` text,
	`intro` text NOT NULL,
	`current_focus` text,
	`can_offer` text,
	`wants_to_meet` text,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`interests_json` text DEFAULT '[]' NOT NULL,
	`roles_json` text DEFAULT '[]' NOT NULL,
	`work_links_json` text DEFAULT '[]' NOT NULL,
	`visibility_json` text DEFAULT '{}' NOT NULL,
	`consent_version` text NOT NULL,
	`consent_accepted_at` integer NOT NULL,
	`submitted_at` integer,
	`reviewed_at` integer,
	`reviewed_by` text,
	`review_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_applications_user` ON `applications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_applications_status_submitted` ON `applications` (`status`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`diff_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_target_created` ON `audit_logs` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`activity_key` text NOT NULL,
	`title` text NOT NULL,
	`activity_date` integer NOT NULL,
	`role` text NOT NULL,
	`outcome` text NOT NULL,
	`public_summary` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`status` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `member_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contributions_profile_status` ON `contributions` (`profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_contributions_activity_status` ON `contributions` (`activity_key`,`status`);--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`metric_date` text NOT NULL,
	`event_type` text NOT NULL,
	`dimension_key` text DEFAULT 'all' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`metric_date`, `event_type`, `dimension_key`)
);
--> statement-breakpoint
CREATE TABLE `magic_link_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_magic_link_token_hash` ON `magic_link_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_magic_link_expiry` ON `magic_link_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `member_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`nickname` text NOT NULL,
	`real_name` text,
	`avatar_key` text,
	`school_id` text NOT NULL,
	`major` text,
	`grade` text,
	`intro` text NOT NULL,
	`current_focus` text,
	`can_offer` text,
	`wants_to_meet` text,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`interests_json` text DEFAULT '[]' NOT NULL,
	`roles_json` text DEFAULT '[]' NOT NULL,
	`work_links_json` text DEFAULT '[]' NOT NULL,
	`publish_status` text NOT NULL,
	`verified_builder` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_member_profiles_user` ON `member_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_member_profiles_slug` ON `member_profiles` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_member_profiles_publish_school` ON `member_profiles` (`publish_status`,`school_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`href` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_notifications_dedupe` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `profile_visibility` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`field_name` text NOT NULL,
	`visibility` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `member_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_profile_visibility_field` ON `profile_visibility` (`profile_id`,`field_name`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`campus` text DEFAULT '主校区' NOT NULL,
	`city` text NOT NULL,
	`longitude_e6` integer NOT NULL,
	`latitude_e6` integer NOT NULL,
	`coordinate_status` text DEFAULT 'suggested' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_schools_name_campus` ON `schools` (`name`,`campus`);--> statement-breakpoint
CREATE INDEX `idx_schools_city` ON `schools` (`city`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_expiry` ON `sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);