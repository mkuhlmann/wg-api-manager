import { db } from '@server/db';
import { peersTable, ServerPeer } from '@server/db/schema';
import { isInterfaceUp, startServer, stopServer, wgShow } from './shell';
import { createLog } from '@server/lib/log';
import { eq } from 'drizzle-orm';

const log = createLog('wg');

const constructWgManager = () => {
	let servers: ServerPeer[] = [];
	const peerInfo: Record<string, { connected: boolean; wgTransferRx: number; wgTransferTx: number; wgLatestHandshake: number; wgEndpoint: string }> = {};

	const _start = async () => {
		servers = await db.query.serverPeersTable.findMany();

		for (const server of servers) {
			log.info(`Checking server ${server.interfaceName}`);
			if (await isInterfaceUp(server.interfaceName)) {
				log.info(`Server ${server.interfaceName} is up, deleting link.`);
				await stopServer(server);
			}
			log.info(`Starting server ${server.interfaceName}`);
			await startServer(server);
		}

		loop();
	};

	const refreshInfo = async () => {
		log.info('Checking servers');
		for (const server of servers) {
			const wgShowResult = await wgShow(server.interfaceName);

			if (!wgShowResult) {
				log.info(`Server is down! Starting server ${server.interfaceName}`);
				await startServer(server);
				continue;
			}

			for (const peer of wgShowResult.peers) {
				peerInfo[peer.publicKey] = {
					connected: Date.now() - peer.latestHandshake * 1000 < 180000,
					wgEndpoint: peer.endpoint,
					wgTransferRx: peer.transferRx,
					wgTransferTx: peer.transferTx,
					wgLatestHandshake: peer.latestHandshake,
				};
			}
		}
	};

	let loopTimeout: Timer | null = null;

	const loop = async () => {
		refreshInfo();
		loopTimeout = setTimeout(loop, 30000);
	};

	const start = () => {
		_start();
	};

	const stop = async () => {
		if (loopTimeout) {
			clearTimeout(loopTimeout);
		}

		for (const server of servers) {
			if (await isInterfaceUp(server.interfaceName)) {
				log.info(`Stopping server ${server.interfaceName}`);
				await stopServer(server);
			}
		}
	};

	return { start, stop, peerInfo };
};

export const wgManager = constructWgManager();
