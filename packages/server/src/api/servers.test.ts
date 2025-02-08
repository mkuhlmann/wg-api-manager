import { serversRoutes } from './servers';
import { db } from '../db';
import { beforeAll, describe, expect, it } from 'bun:test';
import { serverPeersTable } from '@server/db/schema';

describe('serversRouter', () => {
	// Insert a sample server record before tests run
	beforeAll(async () => {
		await db
			.insert(serverPeersTable)
			.values({
				id: 'serversRouter-server',
				friendlyName: 'Test Server',
				interfaceName: 'wg0',
				cidrRange: '10.10.10.0/24',
				reservedIps: 50,
				wgAddress: '10.10.10.1',
				wgListenPort: 51820,
				wgEndpoint: 'testhost:51820',
				wgPrivateKey: 'privateKey',
				wgPublicKey: 'publicKey',
				authToken: 'serverToken',
			})
			.execute();
	});

	const app = serversRoutes;

	describe('/wg/servers', () => {
		it('GET should return list (admin token)', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers', {
					headers: { authorization: 'Bearer adminToken' },
				})
			);
			expect(response.status).toBe(200);
			const result = await response.json();
			expect(Array.isArray(result)).toBe(true);
		});

		it('POST should create a server (admin token)', async () => {
			const body = {
				friendlyName: 'servers-test',
				interfaceName: 'wg1',
				cidrRange: '192.168.1.0/24',
				reservedIps: 100,
				wgAddress: '192.168.1.1',
				wgListenPort: 51821,
				wgEndpoint: 'newhost:51821',
			};
			const response = await app.handle(
				new Request('http://localhost/wg/servers', {
					method: 'POST',
					headers: { authorization: 'Bearer adminToken', 'content-type': 'application/json' },
					body: JSON.stringify(body),
				})
			);
			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result[0]).toHaveProperty('id');
		});

		it('POST should return 400 for invalid interface name (admin token)', async () => {
			const body = {
				friendlyName: 'servers-test',
				interfaceName: 'invalid_interface_name!',
				cidrRange: '192.168.1.0/24',
				reservedIps: 100,
				wgAddress: '192.168.1.1',
				wgListenPort: 51821,
				wgEndpoint: 'newhost:51821',
			};
			const response = await app.handle(
				new Request('http://localhost/wg/servers', {
					method: 'POST',
					headers: { authorization: 'Bearer adminToken', 'content-type': 'application/json' },
					body: JSON.stringify(body),
				})
			);
			expect(response.status).toBe(422);
		});
	});

	describe('/wg/servers/:id', () => {
		it('GET should return server (server token)', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/serversRouter-server', {
					headers: { authorization: 'Bearer serverToken' },
				})
			);
			expect(response.status).toBe(200);
			const server = await response.json();
			expect(server.id).toBe('serversRouter-server');
		});

		it('GET should return server (admin token)', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/serversRouter-server', {
					headers: { authorization: 'Bearer adminToken' },
				})
			);
			expect(response.status).toBe(200);
			const server = await response.json();
			expect(server.id).toBe('serversRouter-server');
		});

		it('PATCH should update a server (server token)', async () => {
			const patchBody = { friendlyName: 'Updated Server' };
			const response = await app.handle(
				new Request('http://localhost/wg/servers/serversRouter-server', {
					method: 'PATCH',
					headers: { authorization: 'Bearer serverToken', 'content-type': 'application/json' },
					body: JSON.stringify(patchBody),
				})
			);
			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result[0].friendlyName).toBe('Updated Server');
		});
	});

	describe('/wg/servers/:id/config', () => {
		it('GET should return server config (server token)', async () => {
			const response = await app.handle(
				new Request('http://localhost/wg/servers/serversRouter-server/config', {
					headers: { authorization: 'Bearer serverToken' },
				})
			);
			expect(response.status).toBe(200);
			const configText = await response.text();
			expect(configText).toContain('10.10.10.1');
		});
	});
});
