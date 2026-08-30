UPDATE `schools`
SET `coordinate_status` = 'confirmed', `updated_at` = unixepoch() * 1000
WHERE `coordinate_status` = 'suggested';
