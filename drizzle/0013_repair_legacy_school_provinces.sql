UPDATE `schools`
SET `province` = '上海'
WHERE `city` IN ('上海', '上海市') OR `name` LIKE '上海交通大学%';
