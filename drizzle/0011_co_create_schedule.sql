ALTER TABLE `co_create_projects` ADD `location` text;
--> statement-breakpoint
ALTER TABLE `co_create_projects` ADD `location_tbd` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `co_create_projects` ADD `starts_at` text;
--> statement-breakpoint
ALTER TABLE `co_create_projects` ADD `ends_at` text;
--> statement-breakpoint
ALTER TABLE `co_create_projects` ADD `time_tbd` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `co_create_projects`
SET `location` = CASE WHEN `scope` = '线上' THEN NULL ELSE `scope` END,
    `location_tbd` = CASE WHEN `scope` = '线上' THEN 1 ELSE 0 END,
    `scope` = CASE WHEN `scope` = '线上' THEN '线上' ELSE '线下' END;
