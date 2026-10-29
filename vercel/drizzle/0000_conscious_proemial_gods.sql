CREATE TABLE `chat_quota` (
	`key` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires` integer NOT NULL
);
