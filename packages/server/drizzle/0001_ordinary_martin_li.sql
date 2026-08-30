CREATE TABLE `peerGroupRules` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`srcGroupId` text NOT NULL,
	`dstGroupId` text,
	`dstCidr` text,
	FOREIGN KEY (`srcGroupId`) REFERENCES `peerGroups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dstGroupId`) REFERENCES `peerGroups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `peerGroups` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`serverPeerId` text NOT NULL,
	`name` text NOT NULL,
	`friendlyName` text,
	`allowServer` integer DEFAULT false NOT NULL,
	`allowInternet` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`serverPeerId`) REFERENCES `serverPeers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `peerGroups_serverPeerId_name_unique` ON `peerGroups` (`serverPeerId`,`name`);--> statement-breakpoint
ALTER TABLE `peers` ADD `groupId` text REFERENCES peerGroups(id);--> statement-breakpoint
ALTER TABLE `serverPeers` ADD `enableNat` integer DEFAULT false NOT NULL;