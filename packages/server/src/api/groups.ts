import { Elysia, status, t } from 'elysia';
import { db } from '../db';
import { peerGroupRulesTable, peerGroupsTable, peersTable, serverPeersTable } from '../db/schema';
import IPCIDR from 'ip-cidr';
import { eq, and, or, ne } from 'drizzle-orm';
import { syncFirewall } from '../wg/firewall';
import { auth } from './auth';
import { createLog } from '@server/lib/log';

const log = createLog('http');

const nameRegex = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

async function findServer(idOrInterfaceName: string) {
	return db.query.serverPeersTable.findFirst({
		where: or(eq(serverPeersTable.id, idOrInterfaceName), eq(serverPeersTable.interfaceName, idOrInterfaceName)),
	});
}

async function isNameInUse(serverPeerId: string, name: string, excludeGroupId?: string) {
	const existing = await db.query.peerGroupsTable.findFirst({
		where: excludeGroupId
			? and(eq(peerGroupsTable.serverPeerId, serverPeerId), eq(peerGroupsTable.name, name), ne(peerGroupsTable.id, excludeGroupId))
			: and(eq(peerGroupsTable.serverPeerId, serverPeerId), eq(peerGroupsTable.name, name)),
	});
	return !!existing;
}

export const groupsRoutes = new Elysia()
	.use(auth)
	.get(
		'/wg/servers/:id/groups',
		async ({ params }) => {
			const server = await findServer(params.id);
			if (!server) {
				return status(404, 'Server not found');
			}

			const groups = await db.query.peerGroupsTable.findMany({ where: eq(peerGroupsTable.serverPeerId, server.id) });

			const result = [];
			for (const group of groups) {
				const rules = await db.query.peerGroupRulesTable.findMany({ where: eq(peerGroupRulesTable.srcGroupId, group.id) });
				const members = await db.query.peersTable.findMany({ where: eq(peersTable.groupId, group.id) });
				result.push({ ...group, rules, memberCount: members.length });
			}

			return result;
		},
		{
			params: t.Object({ id: t.String() }),
			verifyAuth: { scope: 'server' },
		}
	)
	.post(
		'/wg/servers/:id/groups',
		async ({ params, body }) => {
			const server = await findServer(params.id);
			if (!server) {
				return status(404, 'Server not found');
			}

			if (await isNameInUse(server.id, body.name)) {
				return status(400, 'A group with this name already exists on this server');
			}

			const group = await db
				.insert(peerGroupsTable)
				.values({
					serverPeerId: server.id,
					name: body.name,
					friendlyName: body.friendlyName,
					allowServer: body.allowServer,
					allowInternet: body.allowInternet,
				})
				.returning();

			log.info(`Created group ${group[0].id} on server ${server.id}`);
			syncFirewall();

			return group[0];
		},
		{
			body: t.Object({
				name: t.RegExp(nameRegex),
				friendlyName: t.Optional(t.String()),
				allowServer: t.Optional(t.Boolean({ default: false })),
				allowInternet: t.Optional(t.Boolean({ default: false })),
			}),
			params: t.Object({ id: t.String() }),
			verifyAuth: { scope: 'server' },
		}
	)
	.patch(
		'/wg/servers/:id/groups/:groupId',
		async ({ params, body }) => {
			const server = await findServer(params.id);
			if (!server) {
				return status(404, 'Server not found');
			}

			const group = await db.query.peerGroupsTable.findFirst({
				where: and(eq(peerGroupsTable.id, params.groupId), eq(peerGroupsTable.serverPeerId, server.id)),
			});
			if (!group) {
				return status(404, 'Group not found');
			}

			if (body.name && (await isNameInUse(server.id, body.name, group.id))) {
				return status(400, 'A group with this name already exists on this server');
			}

			const updated = await db
				.update(peerGroupsTable)
				.set({
					name: body.name ?? group.name,
					friendlyName: body.friendlyName ?? group.friendlyName,
					allowServer: body.allowServer ?? group.allowServer,
					allowInternet: body.allowInternet ?? group.allowInternet,
					updatedAt: new Date(),
				})
				.where(eq(peerGroupsTable.id, group.id))
				.returning();

			log.info(`Updated group ${group.id} on server ${server.id}`);
			syncFirewall();

			return updated[0];
		},
		{
			body: t.Object({
				name: t.Optional(t.RegExp(nameRegex)),
				friendlyName: t.Optional(t.String()),
				allowServer: t.Optional(t.Boolean()),
				allowInternet: t.Optional(t.Boolean()),
			}),
			params: t.Object({ id: t.String(), groupId: t.String() }),
			verifyAuth: { scope: 'server' },
		}
	)
	.delete(
		'/wg/servers/:id/groups/:groupId',
		async ({ params }) => {
			const server = await findServer(params.id);
			if (!server) {
				return status(404, 'Server not found');
			}

			const group = await db.query.peerGroupsTable.findFirst({
				where: and(eq(peerGroupsTable.id, params.groupId), eq(peerGroupsTable.serverPeerId, server.id)),
			});
			if (!group) {
				return status(404, 'Group not found');
			}

			// no db-level FK enforcement (sqlite foreign_keys pragma isn't turned on
			// anywhere in this codebase), so cascade cleanup happens explicitly here.
			db.transaction((tx) => {
				tx.update(peersTable).set({ groupId: null }).where(eq(peersTable.groupId, group.id)).run();
				tx.delete(peerGroupRulesTable).where(eq(peerGroupRulesTable.srcGroupId, group.id)).run();
				tx.delete(peerGroupRulesTable).where(eq(peerGroupRulesTable.dstGroupId, group.id)).run();
				tx.delete(peerGroupsTable).where(eq(peerGroupsTable.id, group.id)).run();
			});

			log.info(`Deleted group ${group.id} from server ${server.id}`);
			syncFirewall();

			return { success: true };
		},
		{
			params: t.Object({ id: t.String(), groupId: t.String() }),
			verifyAuth: { scope: 'server' },
		}
	)
	.put(
		'/wg/servers/:id/groups/:groupId/rules',
		async ({ params, body }) => {
			const server = await findServer(params.id);
			if (!server) {
				return status(404, 'Server not found');
			}

			const group = await db.query.peerGroupsTable.findFirst({
				where: and(eq(peerGroupsTable.id, params.groupId), eq(peerGroupsTable.serverPeerId, server.id)),
			});
			if (!group) {
				return status(404, 'Group not found');
			}

			for (const dstGroupId of body.dstGroupIds) {
				const dstGroup = await db.query.peerGroupsTable.findFirst({
					where: and(eq(peerGroupsTable.id, dstGroupId), eq(peerGroupsTable.serverPeerId, server.id)),
				});
				if (!dstGroup) {
					return status(400, `Destination group ${dstGroupId} not found on this server`);
				}
			}

			for (const dstCidr of body.dstCidrs) {
				if (!IPCIDR.isValidCIDR(dstCidr)) {
					return status(400, `Invalid CIDR: ${dstCidr}`);
				}
			}

			db.transaction((tx) => {
				tx.delete(peerGroupRulesTable).where(eq(peerGroupRulesTable.srcGroupId, group.id)).run();

				for (const dstGroupId of body.dstGroupIds) {
					tx.insert(peerGroupRulesTable).values({ srcGroupId: group.id, dstGroupId }).run();
				}
				for (const dstCidr of body.dstCidrs) {
					tx.insert(peerGroupRulesTable).values({ srcGroupId: group.id, dstCidr }).run();
				}
			});

			log.info(`Replaced rules for group ${group.id} on server ${server.id}`);
			syncFirewall();

			const rules = await db.query.peerGroupRulesTable.findMany({ where: eq(peerGroupRulesTable.srcGroupId, group.id) });
			return rules;
		},
		{
			body: t.Object({
				dstGroupIds: t.Array(t.String()),
				dstCidrs: t.Array(t.String()),
			}),
			params: t.Object({ id: t.String(), groupId: t.String() }),
			verifyAuth: { scope: 'server' },
		}
	);
