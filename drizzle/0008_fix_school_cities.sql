UPDATE `schools` SET `city` = '潮州', `updated_at` = unixepoch('now') * 1000
WHERE `id` = '7fff75c1-ac07-4dd2-a3d7-15ca83d127b2' AND `city` = '广州';
--> statement-breakpoint
UPDATE `schools` SET `city` = '深圳', `updated_at` = unixepoch('now') * 1000
WHERE `id` = 'd9062b6a-9e48-4830-8eae-7f16d5e0893a' AND `city` = '广州';
