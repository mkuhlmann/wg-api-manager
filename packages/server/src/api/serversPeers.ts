import { Elysia, t } from 'elysia';
import { db } from '../db';
import { Peer, peersTable, serverPeersTable } from '../db/schema';
import IPCIDR from 'ip-cidr';
import { eq, and, or } from 'drizzle-orm';
import { generatePeerConfig, reloadServer, wgDerivePublicKey, wgGenKey, wgGenPsk } from '../wg/wg';
import { wgManager } from '../wg/manager';
import { auth } from './auth';
import { createLog } from '@server/lib/log';

const log = createLog('http');

export const serversPeersRoute = new Elysia()
	.use(auth)
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

			if (body.wgAddress) {
				if (!cidr.contains(body.wgAddress)) {
					throw new Error('wgAddress is not in CIDR range');
				}

				const peer = await db.query.peersTable.findFirst({
					where: and(eq(peersTable.wgAddress, body.wgAddress), eq(peersTable.serverPeerId, server.id)),
				});

				if (peer) {
					throw new Error('IP already in use');
				}

				ip = body.wgAddress;
			} else {
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
			}

			if (!ip) {
				throw new Error('No IP supplied');
			}

			const peer = await db
				.insert(peersTable)
				.values({
					serverPeerId: server.id,
					friendlyName: body.friendlyName,

					wgPrivateKey: privateKey,
					wgPublicKey: publicKey,
					wgPresharedKey: await wgGenPsk(),

					wgAddress: ip,
				})
				.returning();

			log.info(`Created peer ${peer[0].id} on server ${server.id}`);
			reloadServer(server);

			return peer[0];
		},
		{
			body: t.Object({
				friendlyName: t.Optional(t.String()),
				wgAddress: t.Optional(t.String()),
			}),
			params: t.Object({
				id: t.String(),
			}),
			verifyAuth: { scope: 'server' },
		}
	)
	.patch(
		'/wg/servers/:id/peers/:peerId',
		async ({ params, body }) => {
			const server = await db.query.serverPeersTable.findFirst({
				where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
			});

			if (!server || !server.cidrRange) {
				throw new Error('Server not found');
			}

			const peer = await db.query.peersTable.findFirst({
				where: and(eq(peersTable.id, params.peerId), eq(peersTable.serverPeerId, params.id)),
			});

			if (!peer) {
				throw new Error('Peer not found');
			}

			const cidr = new IPCIDR(server.cidrRange);

			let ip: string | null = null;

			if (body.wgAddress) {
				if (!cidr.contains(body.wgAddress)) {
					throw new Error('wgAddress is not in CIDR range');
				}

				const _peer = await db.query.peersTable.findFirst({
					where: and(eq(peersTable.wgAddress, body.wgAddress), eq(peersTable.serverPeerId, server.id)),
				});

				if (_peer && peer.id != _peer.id) {
					throw new Error('IP already in use');
				}

				ip = body.wgAddress;
			} else {
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
			}

			if (!ip) {
				throw new Error('No IP supplied');
			}

			const updatedPeer = await db
				.update(peersTable)
				.set({
					friendlyName: body.friendlyName ?? peer.friendlyName,
					wgAddress: body.wgAddress ?? peer.wgAddress,
				})
				.where(and(eq(peersTable.id, params.peerId), eq(peersTable.serverPeerId, params.id)))
				.returning();

			log.info(`Updated peer ${peer.id} on server ${server.id}`);
			reloadServer(server);

			return updatedPeer;
		},
		{
			body: t.Object({
				friendlyName: t.Optional(t.String()),
				wgAddress: t.Optional(t.String()),
			}),
			params: t.Object({
				id: t.String(),
				peerId: t.String(),
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
	.delete(
		'/wg/servers/:id/peers/:peerId',
		async ({ params }) => {
			const server = await db.query.serverPeersTable.findFirst({
				where: or(eq(serverPeersTable.id, params.id), eq(serverPeersTable.interfaceName, params.id)),
			});

			if (!server) {
				throw new Error('Server not found');
			}

			const peer = await db.query.peersTable.findFirst({
				where: and(eq(peersTable.id, params.peerId), eq(peersTable.serverPeerId, params.id)),
			});

			if (!peer) {
				throw new Error('Peer not found');
			}

			await db.delete(peersTable).where(eq(peersTable.id, params.peerId));
			log.info(`Deleted peer ${peer.id} from server ${server.id}`);
			reloadServer(server);

			return { success: true };
		},
		{
			params: t.Object({
				id: t.String(),
				peerId: t.String(),
			}),
			verifyAuth: { scope: 'server' },
		}
	);
