import { groupsRoutes } from './groups';
import { db } from '../db';
import { beforeAll, describe, expect, it } from 'bun:test';
import { serverPeersTable } from '@server/db/schema';

describe('groupsRouter', () => {
	beforeAll(async () => {
		await db
			.insert(serverPeersTable)
			.values({
				id: 'groupsRouter-server',
				friendlyName: 'Test Server',
				interfaceName: 'wg2',
				cidrRange: '10.40.40.0/24',
				reservedIps: 50,
				wgAddress: '10.40.40.1',
				wgListenPort: 51830,
				wgEndpoint: 'testhost:51830',
				wgPrivateKey: 'privateKey',
				wgPublicKey: 'publicKey',
				authToken: 'groupsRouter-serverToken',
			})
			.execute();

		await db
			.insert(serverPeersTable)
			.values({
				id: 'groupsRouter-otherServer',
				friendlyName: 'Other Server',
				interfaceName: 'wg3',
				cidrRange: '10.50.50.0/24',
				reservedIps: 50,
				wgAddress: '10.50.50.1',
				wgListenPort: 51840,
				wgEndpoint: 'otherhost:51840',
				wgPrivateKey: 'privateKey',
				wgPublicKey: 'publicKey',
				authToken: 'groupsRouter-otherServerToken',
			})
			.execute();
	});

	const app = groupsRoutes;
	const auth = { authorization: 'Bearer adminToken' };

	describe('/wg/servers/:id/groups', () => {
		it('GET should return 401 without a token', async () => {
			const response = await app.handle(new Request('http://localhost/wg/servers/groupsRouter-server/groups'));
			expect(response.status).toBe(401);
		});

		it('GET should return 404 for an unknown server', async () => {
			const response = await app.handle(new Request('http://localhost/wg/servers/does-not-exist/groups', { headers: auth }));
			expect(response.status).toBe(404);
		});

		it('GET should return an empty list for a server with no groups', async () => {
			const response = await app.handle(new Request('http://localhost/wg/servers/groupsRouter-server/groups', { headers: auth }));
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual([]);
		});

		it('POST should create a group', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/groupsRouter-server/groups', {
					method: 'POST',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'office', friendlyName: 'Office' }),
				})
			);
			expect(response.status).toBe(200);
			const group = await response.json();
			expect(group.name).toBe('office');
			expect(group.serverPeerId).toBe('groupsRouter-server');
			expect(group.allowServer).toBe(false);
			expect(group.allowInternet).toBe(false);
		});

		it('POST should reject a duplicate name on the same server', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/groupsRouter-server/groups', {
					method: 'POST',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'office' }),
				})
			);
			expect(response.status).toBe(400);
		});

		it('POST should reject an invalid name', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/groupsRouter-server/groups', {
					method: 'POST',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'Not A Slug!' }),
				})
			);
			expect(response.status).toBe(422);
		});

		it('POST should allow the same name on a different server', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/groupsRouter-otherServer/groups', {
					method: 'POST',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'office' }),
				})
			);
			expect(response.status).toBe(200);
		});

		it('GET should list groups with rules and memberCount', async () => {
			const response = await app.handle(new Request('http://localhost/wg/servers/groupsRouter-server/groups', { headers: auth }));
			const groups = await response.json();
			expect(groups.length).toBe(1);
			expect(groups[0].name).toBe('office');
			expect(groups[0].memberCount).toBe(0);
			expect(groups[0].rules).toEqual([]);
		});
	});

	describe('/wg/servers/:id/groups/:groupId', () => {
		it('PATCH should update a group', async () => {
			const group = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-server'), eq(t.name, 'office')) });

			const response = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${group!.id}`, {
					method: 'PATCH',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ allowServer: true, allowInternet: true }),
				})
			);
			expect(response.status).toBe(200);
			const updated = await response.json();
			expect(updated.allowServer).toBe(true);
			expect(updated.allowInternet).toBe(true);
		});

		it('PATCH should return 404 for a group on a different server', async () => {
			const group = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-otherServer'), eq(t.name, 'office')) });

			const response = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${group!.id}`, {
					method: 'PATCH',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ allowServer: true }),
				})
			);
			expect(response.status).toBe(404);
		});
	});

	describe('/wg/servers/:id/groups/:groupId/rules', () => {
		it('PUT should reject a dstGroupId belonging to a different server', async () => {
			const office = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-server'), eq(t.name, 'office')) });
			const otherOffice = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-otherServer'), eq(t.name, 'office')) });

			const response = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${office!.id}/rules`, {
					method: 'PUT',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ dstGroupIds: [otherOffice!.id], dstCidrs: [] }),
				})
			);
			expect(response.status).toBe(400);
		});

		it('PUT should reject an invalid dstCidr', async () => {
			const office = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-server'), eq(t.name, 'office')) });

			const response = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${office!.id}/rules`, {
					method: 'PUT',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ dstGroupIds: [], dstCidrs: ['not-a-cidr'] }),
				})
			);
			expect(response.status).toBe(400);
		});

		it('PUT should replace the rule set atomically (delete-then-insert)', async () => {
			const office = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-server'), eq(t.name, 'office')) });

			const first = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${office!.id}/rules`, {
					method: 'PUT',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ dstGroupIds: [], dstCidrs: ['192.168.50.0/24'] }),
				})
			);
			expect(first.status).toBe(200);
			expect((await first.json()).length).toBe(1);

			const second = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${office!.id}/rules`, {
					method: 'PUT',
					headers: { ...auth, 'content-type': 'application/json' },
					body: JSON.stringify({ dstGroupIds: [office!.id], dstCidrs: [] }),
				})
			);
			expect(second.status).toBe(200);
			const rules = await second.json();
			expect(rules.length).toBe(1);
			expect(rules[0].dstGroupId).toBe(office!.id);
			expect(rules[0].dstCidr).toBeNull();
		});
	});

	describe('DELETE /wg/servers/:id/groups/:groupId', () => {
		it('should unassign member peers and remove referencing rules before deleting', async () => {
			const office = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-server'), eq(t.name, 'office')) });

			// self-referencing rule (diagonal) exists on `office` from the prior test -
			// deleting the group it points at must not leave a dangling reference.
			const response = await app.handle(
				new Request(`http://localhost/wg/servers/groupsRouter-server/groups/${office!.id}`, {
					method: 'DELETE',
					headers: auth,
				})
			);
			expect(response.status).toBe(200);

			const stillThere = await db.query.peerGroupsTable.findFirst({ where: (t, { eq }) => eq(t.id, office!.id) });
			expect(stillThere).toBeUndefined();

			const rules = await db.query.peerGroupRulesTable.findMany({ where: (t, { eq }) => eq(t.srcGroupId, office!.id) });
			expect(rules.length).toBe(0);
		});

		it('should return 404 for an already-deleted group', async () => {
			const office = await db.query.peerGroupsTable.findFirst({ where: (t, { eq, and }) => and(eq(t.serverPeerId, 'groupsRouter-otherServer'), eq(t.name, 'office')) });

			const first = await app.handle(new Request(`http://localhost/wg/servers/groupsRouter-otherServer/groups/${office!.id}`, { method: 'DELETE', headers: auth }));
			expect(first.status).toBe(200);

			const second = await app.handle(new Request(`http://localhost/wg/servers/groupsRouter-otherServer/groups/${office!.id}`, { method: 'DELETE', headers: auth }));
			expect(second.status).toBe(404);
		});
	});
});
