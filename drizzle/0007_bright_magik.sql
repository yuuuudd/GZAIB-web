CREATE TABLE `activity_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`stage` text NOT NULL,
	`time_note` text,
	`location` text,
	`support_needed` text,
	`links_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_proposals_user_submitted` ON `activity_proposals` (`user_id`,`submitted_at`);
--> statement-breakpoint
CREATE INDEX `idx_activity_proposals_status_submitted` ON `activity_proposals` (`status`,`submitted_at`);
