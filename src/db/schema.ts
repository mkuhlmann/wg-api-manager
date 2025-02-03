import { relations } from 'drizzle-orm';
import {
	integer,
	text,
	pgTable,
	timestamp,
	AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const serverPeersTable = pgTable('serverPeers', {
	id: text()
		.primaryKey()
		.$defaultFn(() => nanoid()),

	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp()
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),

	friendlyName: text(),

	authToken: text()
		.notNull()
		.$defaultFn(() => nanoid(32)),

	interfaceName: text().notNull(),
	cidrRange: text().notNull(),
	reservedIps: integer().notNull(),

	wgEndpoint: text().notNull(),
	wgListenPort: integer().notNull(),
	wgAddress: text().notNull(),

	wgPrivateKey: text().notNull(),
	wgPublicKey: text().notNull(),
});

export type ServerPeer = typeof serverPeersTable.$inferSelect;

export const peersTable = pgTable('peers', {
	id: text()
		.primaryKey()
		.$defaultFn(() => nanoid()),

	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp()
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),

	friendlyName: text(),

	authToken: text()
		.notNull()
		.$defaultFn(() => nanoid(32)),

	serverPeerId: text()
		.notNull()
		.references(() => serverPeersTable.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),

	wgAddress: text().notNull(),

	wgPrivateKey: text().notNull(),
	wgPublicKey: text().notNull(),
	wgPresharedKey: text(),
});

export const peersRelation = relations(peersTable, ({ one }) => ({
	serverPeer: one(serverPeersTable, {
		fields: [peersTable.serverPeerId],
		references: [serverPeersTable.id],
	}),
}));

export type Peer = typeof peersTable.$inferSelect;
