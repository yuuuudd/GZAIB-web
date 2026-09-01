CREATE TABLE `communities` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `summary` text NOT NULL,
  `primary_city` text,
  `location_mode` text NOT NULL CHECK (`location_mode` IN ('city', 'hybrid', 'online')),
  `focus_tags_json` text DEFAULT '[]' NOT NULL,
  `official_url` text NOT NULL,
  `source_url` text NOT NULL,
  `source_label` text NOT NULL,
  `publish_status` text DEFAULT 'draft' NOT NULL CHECK (`publish_status` IN ('draft', 'published', 'archived')),
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_profile_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `community_id` text REFERENCES `communities`(`id`),
  `submitter_user_id` text NOT NULL REFERENCES `users`(`id`),
  `kind` text NOT NULL CHECK (`kind` IN ('create', 'update')),
  `name` text NOT NULL,
  `summary` text NOT NULL,
  `primary_city` text,
  `location_mode` text NOT NULL CHECK (`location_mode` IN ('city', 'hybrid', 'online')),
  `focus_tags_json` text NOT NULL,
  `official_url` text NOT NULL,
  `source_url` text NOT NULL,
  `source_label` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('pending', 'changes_requested', 'approved', 'rejected')),
  `submitted_at` integer NOT NULL,
  `reviewed_at` integer,
  `reviewed_by` text REFERENCES `users`(`id`),
  `review_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `community_id` text NOT NULL REFERENCES `communities`(`id`),
  `applicant_user_id` text NOT NULL REFERENCES `users`(`id`),
  `evidence` text NOT NULL,
  `evidence_url` text,
  `status` text NOT NULL CHECK (`status` IN ('pending', 'changes_requested', 'approved', 'rejected')),
  `submitted_at` integer NOT NULL,
  `reviewed_at` integer,
  `reviewed_by` text REFERENCES `users`(`id`),
  `review_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_managers` (
  `community_id` text NOT NULL REFERENCES `communities`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `role` text DEFAULT 'owner' NOT NULL CHECK (`role` IN ('owner', 'editor')),
  `created_at` integer NOT NULL,
  PRIMARY KEY(`community_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `community_updates` (
  `id` text PRIMARY KEY NOT NULL,
  `community_id` text NOT NULL REFERENCES `communities`(`id`),
  `submitter_user_id` text NOT NULL REFERENCES `users`(`id`),
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `occurred_at` integer NOT NULL,
  `source_url` text,
  `status` text NOT NULL CHECK (`status` IN ('pending', 'changes_requested', 'published', 'rejected', 'archived')),
  `submitted_at` integer NOT NULL,
  `reviewed_at` integer,
  `reviewed_by` text REFERENCES `users`(`id`),
  `review_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_follows` (
  `community_id` text NOT NULL REFERENCES `communities`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL,
  PRIMARY KEY(`community_id`, `user_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_communities_slug` ON `communities` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_communities_status_city` ON `communities` (`publish_status`, `primary_city`);
--> statement-breakpoint
CREATE INDEX `idx_community_submissions_status` ON `community_profile_submissions` (`status`, `submitted_at`);
--> statement-breakpoint
CREATE INDEX `idx_community_claims_status` ON `community_claims` (`status`, `submitted_at`);
--> statement-breakpoint
CREATE INDEX `idx_community_managers_user` ON `community_managers` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_community_updates_public` ON `community_updates` (`community_id`, `status`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `idx_community_follows_user` ON `community_follows` (`user_id`, `created_at`);
