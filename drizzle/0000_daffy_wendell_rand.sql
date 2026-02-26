CREATE TABLE `match_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`point_index` integer,
	`winner` text,
	`is_error` integer DEFAULT false,
	`is_winner` integer DEFAULT false,
	`shot_type` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`video_path` text NOT NULL,
	`duration_seconds` integer,
	`date` text,
	`opponent` text,
	`result` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
