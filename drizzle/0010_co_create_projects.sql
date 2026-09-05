CREATE TABLE `co_create_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`scope` text NOT NULL,
	`recruitment_status` text NOT NULL,
	`summary` text NOT NULL,
	`details` text NOT NULL,
	`problem` text NOT NULL,
	`roles` text NOT NULL,
	`effort` text NOT NULL,
	`deadline` text,
	`level` text NOT NULL,
	`publish_status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_co_create_public_updated` ON `co_create_projects` (`publish_status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_co_create_owner_updated` ON `co_create_projects` (`owner_user_id`,`updated_at`);
--> statement-breakpoint
INSERT INTO `co_create_projects` (`id`,`owner_user_id`,`title`,`type`,`scope`,`recruitment_status`,`summary`,`details`,`problem`,`roles`,`effort`,`deadline`,`level`,`publish_status`,`created_at`,`updated_at`)
SELECT 'ai-night', `id`, '广州高校 AI 共创夜', '活动协作', '广州', '招募中', '围绕 AI 工具、真实案例和校园实践，组织一场 90 分钟的跨校交流。', '邀请不同高校的同学分享真实使用经验，一起完成议程、现场协作与活动记录。', '高校同学缺少一个低门槛、重实践的 AI 交流场景。', '主持人 1 名、摄影记录 1 名、现场协助 2 名', '活动前 2 小时 + 活动当天', '2026-09-10', '新手友好', 'published', 1788537600000, 1788537600000 FROM `users` WHERE lower(`email`) = '2074712958@qq.com';
--> statement-breakpoint
INSERT INTO `co_create_projects` (`id`,`owner_user_id`,`title`,`type`,`scope`,`recruitment_status`,`summary`,`details`,`problem`,`roles`,`effort`,`deadline`,`level`,`publish_status`,`created_at`,`updated_at`)
SELECT 'knowledge-base', `id`, '校园知识库 AI 原型小组', '项目共创', '跨校', '组队中', '用一周时间做出一个面向学生社团的 AI 知识库原型。', '先梳理社团常见问题和现有资料，再完成一个可检索、可演示的网页原型。', '社团资料分散，新成员很难快速找到可靠答案。', '产品 1 名、前端 1 名、视觉设计 1 名', '每周约 3 小时', '2026-09-15', '需要经验', 'published', 1788537600001, 1788537600001 FROM `users` WHERE lower(`email`) = '2074712958@qq.com';
--> statement-breakpoint
INSERT INTO `co_create_projects` (`id`,`owner_user_id`,`title`,`type`,`scope`,`recruitment_status`,`summary`,`details`,`problem`,`roles`,`effort`,`deadline`,`level`,`publish_status`,`created_at`,`updated_at`)
SELECT 'tool-sharing', `id`, 'AI 工具实践分享征集', '活动协作', '线上', '想法征集', '分享你真正使用过的 AI 工具、工作流或失败经验。', '征集短分享并整理成可复用的实践记录，重点保留真实过程、效果与踩坑经验。', '工具介绍很多，但来自真实校园场景的可复用经验仍然很少。', '分享者 5 名', '准备一次 5–20 分钟分享', '2026-09-20', '新手友好', 'published', 1788537600002, 1788537600002 FROM `users` WHERE lower(`email`) = '2074712958@qq.com';
