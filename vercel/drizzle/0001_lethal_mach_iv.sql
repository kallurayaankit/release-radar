CREATE TABLE `oauth_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`version` text NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_pending` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`expires` integer NOT NULL
);
