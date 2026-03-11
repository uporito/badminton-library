CREATE TABLE `players` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `wins_with` integer NOT NULL DEFAULT 0,
  `wins_against` integer NOT NULL DEFAULT 0,
  `losses_with` integer NOT NULL DEFAULT 0,
  `losses_against` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);
--> statement-breakpoint
CREATE TABLE `match_players` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `match_id` integer NOT NULL REFERENCES `matches`(`id`) ON DELETE CASCADE,
  `player_id` integer NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `players` (`name`, `created_at`, `updated_at`)
SELECT DISTINCT `opponent`, strftime('%s','now') * 1000, strftime('%s','now') * 1000
FROM `matches`
WHERE `opponent` IS NOT NULL AND `opponent` != '';
--> statement-breakpoint
INSERT INTO `match_players` (`match_id`, `player_id`, `role`)
SELECT m.`id`, p.`id`, 'opponent'
FROM `matches` m
JOIN `players` p ON p.`name` = m.`opponent`
WHERE m.`opponent` IS NOT NULL AND m.`opponent` != '';
--> statement-breakpoint
ALTER TABLE `matches` ADD COLUMN `won_by_me` integer;
--> statement-breakpoint
ALTER TABLE `matches` ADD COLUMN `partner_status` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE `matches` DROP COLUMN `opponent`;
