ALTER TABLE `schools` ADD `province` text NOT NULL DEFAULT '广东';
--> statement-breakpoint
UPDATE `schools`
SET `province` = '湖北'
WHERE `city` IN ('武汉', '武汉市') OR `name` LIKE '武汉大学%';
--> statement-breakpoint
CREATE INDEX `idx_schools_province_city` ON `schools` (`province`,`city`);
