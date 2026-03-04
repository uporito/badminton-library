CREATE TABLE `match_rallies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`rally_length` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_shots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`rally_id` integer NOT NULL,
	`shot_type` text NOT NULL,
	`zone_from_side` text NOT NULL,
	`zone_from` text NOT NULL,
	`zone_to_side` text NOT NULL,
	`zone_to` text NOT NULL,
	`outcome` text NOT NULL,
	`is_last_shot_of_rally` integer DEFAULT false NOT NULL,
	`player` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rally_id`) REFERENCES `match_rallies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `match_stats`;
