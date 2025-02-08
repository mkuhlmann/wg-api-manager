CREATE TABLE `peers` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`friendlyName` text,
	`authToken` text NOT NULL,
	`serverPeerId` text NOT NULL,
	`wgAddress` text NOT NULL,
	`wgPrivateKey` text NOT NULL,
	`wgPublicKey` text NOT NULL,
	`wgPresharedKey` text,
	FOREIGN KEY (`serverPeerId`) REFERENCES `serverPeers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `serverPeers` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`friendlyName` text,
	`authToken` text NOT NULL,
	`interfaceName` text NOT NULL,
	`cidrRange` text NOT NULL,
	`reservedIps` integer NOT NULL,
	`wgEndpoint` text NOT NULL,
	`wgListenPort` integer NOT NULL,
	`wgAddress` text NOT NULL,
	`wgPrivateKey` text NOT NULL,
	`wgPublicKey` text NOT NULL
);
