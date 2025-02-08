import { Elysia, t } from 'elysia';
import { generatePeerConfig, generateServerConfig, wgDerivePublicKey, wgGenKey, wgGenPsk } from './wg/wg';
import swagger from '@elysiajs/swagger';
import { db } from './db';
import { Peer, peersTable, serverPeersTable } from './db/schema';
import IPCIDR from 'ip-cidr';
import { eq, or, and } from 'drizzle-orm';
import { auth } from './api/auth';
import { wgManager } from './wg/manager';
import staticPlugin from '@elysiajs/static';
import { createLog } from './lib/log';

const log = createLog('http');

const _app = new Elysia()
	.use(
		swagger({
			documentation: {
				components: {
					securitySchemes: {
						bearerAuth: {
							type: 'http',
							scheme: 'bearer',
						},
					},
				},
			},
		})
	)
	.onBeforeHandle(({ request, server }) => {
		log.info(`${request.method} ${request.url} ${server?.requestIP(request)?.address}`);
	})
	.use(auth)
	.group('/api/v1', (app) =>
		app
			.get(
				'/wg/servers',
				async () => {
					return db.query.serverPeersTable.findMany();
				},
				{
					verifyAuth: { scope: 'admin' },
				}
			)
			.post(
				'/wg/servers',
				async ({ body }) => {
					const privateKey = await wgGenKey();
					const publicKey = await wgDerivePublicKey(privateKey);

					if (!IPCIDR.isValidCIDR(body.cidrRange)) {
						throw new Error('Invalid CIDR range');
					}

					if (!new IPCIDR(body.cidrRange).contains(body.wgAddress)) {
						throw new Error('wgAddress is not in CIDR range');
					}

					const peer = await db
						.insert(serverPeersTable)
						.values({
							interfaceName: body.interfaceName,
							reservedIps: body.reservedIps,

							wgAddress: body.wgAddress,
							wgEndpoint: body.wgEndpoint,
							wgListenPort: body.wgListenPort,

							cidrRange: body.cidrRange,

							wgPrivateKey: privateKey,
							wgPublicKey: publicKey,
						})
						.returning();

					return peer;
				},
				{
					body: t.Object({
						interfaceName: t.String(),
						cidrRange: t.String(),
						reservedIps: t.Integer({ default: 50 }),

						wgEndpoint: t.String(),
						wgListenPort: t.Integer(),
						wgAddress: t.String(),
					}),
					verifyAuth: { scope: 'admin' },
				}
			)
			.get(
				'/wg/servers/:id',
				async ({ params }) => {
					const server = await db.query.serverPeersTable.findFirst({
						where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
					});

					if (!server) {
						throw new Error('Server not found');
					}

					return server;
				},
				{
					params: t.Object({ id: t.String() }),
					verifyAuth: { scope: 'admin' },
				}
			)
			.get(
				'/wg/servers/:id/config',
				async ({ params }) => {
					const server = await db.query.serverPeersTable.findFirst({
						where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
					});

					if (!server) {
						throw new Error('Server not found');
					}

					return await generateServerConfig(server);
				},
				{
					params: t.Object({
						id: t.String(),
					}),
					verifyAuth: { scope: 'server' },
				}
			)
			.get(
				'/wg/servers/:id/peers',
				async ({ params }) => {
					const server = await db.query.serverPeersTable.findFirst({
						where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
					});

					if (!server) {
						throw new Error('Server not found');
					}

					let peers = await db.query.peersTable.findMany({
						where: eq(peersTable.serverPeerId, server.id),
					});

					const peersWithInfo: (Peer & { peerInfo: null | { connected: boolean; wgTransferRx: number; wgTransferTx: number; wgLatestHandshake: number; wgEndpoint: string } })[] = [];

					for (const peer of peers) {
						peersWithInfo.push({ ...peer, peerInfo: wgManager.peerInfo[peer.wgPublicKey] ?? null });
					}

					return peersWithInfo;
				},
				{
					params: t.Object({
						id: t.String(),
					}),
					verifyAuth: { scope: 'server' },
				}
			)
			.post(
				'/wg/servers/:id/peers',
				async ({ params, body }) => {
					const server = await db.query.serverPeersTable.findFirst({
						where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
					});

					if (!server || !server.cidrRange) {
						throw new Error('Server not found');
					}

					const privateKey = await wgGenKey();
					const publicKey = await wgDerivePublicKey(privateKey);

					const cidr = new IPCIDR(server.cidrRange);

					let ip: string | null = null;
					let fromIp = server.reservedIps!;

					do {
						const ips = cidr.toArray({ from: fromIp, limit: 1 });

						if (ips.length == 0) {
							throw new Error('No more IPs available');
						}

						const _ip = ips[0];

						const peer = await db.query.peersTable.findFirst({
							where: and(eq(peersTable.wgAddress, _ip), eq(peersTable.serverPeerId, server.id)),
						});

						if (!peer) {
							ip = _ip;
						} else {
							fromIp++;
						}

						if (fromIp > 1000000) {
							throw new Error('No more IPs available (loop)');
						}
					} while (ip == null);

					const peer = await db
						.insert(peersTable)
						.values({
							serverPeerId: server.id,
							friendlyName: body.name,

							wgPrivateKey: privateKey,
							wgPublicKey: publicKey,
							wgPresharedKey: await wgGenPsk(),

							wgAddress: ip,
						})
						.returning();

					return peer;
				},
				{
					body: t.Object({
						name: t.Optional(t.String()),
					}),
					params: t.Object({
						id: t.String(),
					}),
					verifyAuth: { scope: 'server' },
				}
			)
			.get(
				'/wg/servers/:id/peers/:peerId/config',
				async ({ params }) => {
					const peer = await db.query.peersTable.findFirst({
						where: and(eq(peersTable.id, params.peerId), eq(peersTable.serverPeerId, params.id)),
					});

					if (!peer || peer.serverPeerId != params.id) {
						throw new Error('Peer not found');
					}

					return generatePeerConfig(peer);
				},
				{
					params: t.Object({
						id: t.String(),
						peerId: t.String(),
					}),
					verifyAuth: { scope: 'server' },
				}
			)
			.get(
				'/wg/peers/:id/config',
				async ({ params }) => {
					const peer = await db.query.peersTable.findFirst({
						where: and(eq(peersTable.id, params.id)),
					});

					if (!peer) {
						throw new Error('Peer not found');
					}

					return generatePeerConfig(peer);
				},
				{
					params: t.Object({
						id: t.String(),
					}),
					verifyAuth: { scope: 'peer' },
				}
			)
	)
	.use(
		staticPlugin({
			indexHTML: true,
			assets: '../app/dist',
			prefix: '',
		})
	)
	.listen(3000);

wgManager.start();

export type App = typeof _app;

log.info(`🦊 api ist running at ${_app.server?.hostname}:${_app.server?.port}`);
