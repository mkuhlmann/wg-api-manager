import { peersRoutes } from './peers';
import { db } from '../db';
import { beforeAll, describe, expect, it } from 'bun:test';
import { peersTable, serverPeersTable } from '@server/db/schema';

describe('GET /wg/peers/:id/config', () => {
	beforeAll(async () => {
		await db
			.insert(serverPeersTable)
			.values({
				id: 'peersRouters-server',
				interfaceName: 'wg0',
				cidrRange: '10.20.20.0/24',
				reservedIps: 10,
				wgAddress: '10.20.20.1',
				wgListenPort: 51820,
				wgEndpoint: 'endpoint:51820',
				wgPrivateKey: 'privateKey',
				wgPublicKey: 'publicKey',
				authToken: 'serverPeerToken',
			})
			.execute();

		await db
			.insert(peersTable)
			.values({
				id: 'peersRouters-peer',
				serverPeerId: 'peersRouters-server',
				wgAddress: '10.20.20.2',
				wgPublicKey: 'publicKey',
				wgPrivateKey: 'privateKey',
				wgPresharedKey: 'presharedKey',
				authToken: 'peerToken',
			})
			.execute();
	});
	const app = peersRoutes;

	it('should return 401 if no token is provided', async () => {
		const response = await app.handle(new Request('http://localhost/wg/peers/1/config'));
		expect(response.status).toBe(401);
	});

	it('should return 404 if peer does not exist', async () => {
		const response = await app.handle(
			new Request('http://localhost/wg/peers/non-existing/config', {
				headers: {
					authorization: 'Bearer adminToken',
				},
			})
		);
		expect(response.status).toBe(404);
	});

	it('should return 200 if peer exists (peer token)', async () => {
		const response = await app.handle(
			new Request('http://localhost/wg/peers/peersRouters-peer/config', {
				headers: {
					authorization: 'Bearer peerToken',
				},
			})
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toInclude('endpoint:51820');
	});

	it('should return 200 if peer exists (server token)', async () => {
		const response = await app.handle(
			new Request('http://localhost/wg/peers/peersRouters-peer/config', {
				headers: {
					authorization: 'Bearer adminToken',
				},
			})
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toInclude('endpoint:51820');
	});

	it('should return 401 if peer token is invalid', async () => {
		const response = await app.handle(
			new Request('http://localhost/wg/peers/peersRouters-peer/config', {
				headers: {
					authorization: 'Bearer invalidToken',
				},
			})
		);
	});
});
