import { relations } from 'drizzle-orm';
import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

export const serverPeersTable = sqliteTable('serverPeers', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),

	createdAt: integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	friendlyName: text('friendlyName'),

	authToken: text('authToken')
		.notNull()
		.$defaultFn(() => nanoid(32)),

	interfaceName: text('interfaceName').notNull(),
	cidrRange: text('cidrRange').notNull(),
	reservedIps: integer('reservedIps').notNull(),

	wgEndpoint: text('wgEndpoint').notNull(),
	wgListenPort: integer('wgListenPort').notNull(),
	wgAddress: text('wgAddress').notNull(),

	wgPrivateKey: text('wgPrivateKey').notNull(),
	wgPublicKey: text('wgPublicKey').notNull(),
});

export type ServerPeer = typeof serverPeersTable.$inferSelect;

export const peersTable = sqliteTable('peers', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),

	createdAt: integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	friendlyName: text('friendlyName'),

	authToken: text('authToken')
		.notNull()
		.$defaultFn(() => nanoid(32)),

	serverPeerId: text('serverPeerId')
		.notNull()
		.references(() => serverPeersTable.id),

	wgAddress: text('wgAddress').notNull(),

	wgPrivateKey: text('wgPrivateKey').notNull(),
	wgPublicKey: text('wgPublicKey').notNull(),
	wgPresharedKey: text('wgPresharedKey'),
});

export const peersRelation = relations(peersTable, ({ one }) => ({
	serverPeer: one(serverPeersTable, {
		fields: [peersTable.serverPeerId],
		references: [serverPeersTable.id],
	}),
}));

export type Peer = typeof peersTable.$inferSelect;
