CREATE TABLE `jira_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jira_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`site` text NOT NULL,
	`fingerprint` text NOT NULL,
	`phase` text NOT NULL,
	`issue_key` text,
	`attachment_id` text,
	`updated` integer NOT NULL
);
