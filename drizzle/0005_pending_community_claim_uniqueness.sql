CREATE UNIQUE INDEX `ux_community_claims_pending_applicant` ON `community_claims` (`applicant_user_id`, `community_id`) WHERE `status` = 'pending';
