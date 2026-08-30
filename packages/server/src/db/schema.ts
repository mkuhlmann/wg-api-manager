import { relations } from 'drizzle-orm';
import { integer, text, sqliteTable, unique } from 'drizzle-orm/sqlite-core';
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

	// gates masquerade for this server's cidrRange. `allowInternet` on a group is
	// inert without this - keeps upgrading an existing deployment from silently
	// turning it into an internet gateway.
	enableNat: integer('enableNat', { mode: 'boolean' }).notNull().default(false),
});

export type ServerPeer = typeof serverPeersTable.$inferSelect;

export const peerGroupsTable = sqliteTable(
	'peerGroups',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),

		createdAt: integer('createdAt', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),

		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),

		serverPeerId: text('serverPeerId')
			.notNull()
			.references(() => serverPeersTable.id, { onDelete: 'cascade' }),

		name: text('name').notNull(),
		friendlyName: text('friendlyName'),

		// may this group reach the wireguard server's own tunnel address (dns, mgmt api, ...)
		allowServer: integer('allowServer', { mode: 'boolean' }).notNull().default(false),
		// may this group's traffic egress to the internet (requires server.enableNat too)
		allowInternet: integer('allowInternet', { mode: 'boolean' }).notNull().default(false),
	},
	(t) => [unique().on(t.serverPeerId, t.name)]
);

export type PeerGroup = typeof peerGroupsTable.$inferSelect;

export const peerGroupsRelation = relations(peerGroupsTable, ({ one }) => ({
	serverPeer: one(serverPeersTable, {
		fields: [peerGroupsTable.serverPeerId],
		references: [serverPeersTable.id],
	}),
}));

export const peerGroupRulesTable = sqliteTable('peerGroupRules', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),

	createdAt: integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),

	srcGroupId: text('srcGroupId')
		.notNull()
		.references(() => peerGroupsTable.id, { onDelete: 'cascade' }),

	// exactly one of dstGroupId / dstCidr is set - enforced at the api layer
	dstGroupId: text('dstGroupId').references(() => peerGroupsTable.id, { onDelete: 'cascade' }),
	dstCidr: text('dstCidr'),
});

export type PeerGroupRule = typeof peerGroupRulesTable.$inferSelect;

export const peerGroupRulesRelation = relations(peerGroupRulesTable, ({ one }) => ({
	srcGroup: one(peerGroupsTable, {
		fields: [peerGroupRulesTable.srcGroupId],
		references: [peerGroupsTable.id],
	}),
	dstGroup: one(peerGroupsTable, {
		fields: [peerGroupRulesTable.dstGroupId],
		references: [peerGroupsTable.id],
	}),
}));

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

	// null = unrestricted (today's behaviour). set = reachability is bound by the group's rules.
	groupId: text('groupId').references(() => peerGroupsTable.id, { onDelete: 'set null' }),
});

export const peersRelation = relations(peersTable, ({ one }) => ({
	serverPeer: one(serverPeersTable, {
		fields: [peersTable.serverPeerId],
		references: [serverPeersTable.id],
	}),
	group: one(peerGroupsTable, {
		fields: [peersTable.groupId],
		references: [peerGroupsTable.id],
	}),
}));

export type Peer = typeof peersTable.$inferSelect;
