import { $, ShellOutput } from 'bun';
import { peersTable, ServerPeer, serverPeersTable, type Peer } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { createLog } from '@server/lib/log';

import { exec } from 'child_process';
import { promisify } from 'util';

const log = createLog('wg');

const execAsync = promisify(exec);

export const cmd = async (command: string) => {
	try {
		log.info(`⚙️  ${command}`);
		let shell = '';
		try {
			await execAsync('command -v bash');
			shell = 'bash';
		} catch {
			try {
				await execAsync('command -v ash');
				shell = 'ash';
			} catch {
				throw new Error('Neither bash nor ash shell is available.');
			}
		}
		const { stdout, stderr } = await execAsync(command, { shell });
		return { stdout: stdout.trim(), stderr: stderr.trim() };
	} catch (error) {
		log.error(error);
		throw error;
	}
};

export const wgGenKey = async () => {
	return (await $`wg genkey`.text()).trim();
};

export const wgGenPsk = async () => {
	return (await $`wg genpsk`.text()).trim();
};

export const wgDerivePublicKey = async (privateKey: string) => {
	return (await $`wg pubkey < ${new Response(privateKey)}`.text()).trim();
};

export const wgShow = async (interfaceName: string) => {
	try {
		const output = (await $`wg show ${interfaceName} dump`.text()) ?? '';
		const lines = output.trim().split('\n');
		if (!lines.length) return null;
		const [privateKey, publicKey, listenPort, fwmark] = lines[0].split('\t');
		const peers = lines.slice(1).map((line) => {
			const [publicKey, presharedKey, endpoint, allowedIps, latestHandshake, transferRx, transferTx, persistentKeepalive] = line.split('\t');
			return {
				publicKey,
				presharedKey,
				endpoint,
				allowedIps,
				latestHandshake: parseInt(latestHandshake, 10),
				transferRx: parseInt(transferRx, 10),
				transferTx: parseInt(transferTx, 10),
				persistentKeepalive,
			};
		});
		return {
			interface: { privateKey, publicKey, listenPort, fwmark },
			peers,
		};
	} catch (error) {
		log.error(error);
		return null;
	}
};

export const isInterfaceUp = async (interfaceName: string) => {
	const output = (await $`ip a`.text()) ?? '';
	return output.includes(interfaceName);
};

export const startServer = async (server: ServerPeer) => {
	Bun.write('/tmp/' + server.interfaceName + '.conf', await generateServerConfig(server), { mode: 0o600 });
	await cmd(`wg-quick up /tmp/${server.interfaceName}.conf`);
};

export const reloadServer = async (server: ServerPeer) => {
	Bun.write('/tmp/' + server.interfaceName + '.conf', await generateServerConfig(server), { mode: 0o600 });
	await cmd(`wg syncconf ${server.interfaceName} <(wg-quick strip /tmp/${server.interfaceName}.conf)`);
};

export const stopServer = async (server: ServerPeer) => {
	await cmd(`ip link delete dev ${server.interfaceName}`);
};

export const generateServerConfig = async (server: ServerPeer) => {
	const peers = await db.query.peersTable.findMany({
		where: eq(peersTable.serverPeerId, server.id),
	});

	let config = `[Interface]
PrivateKey = ${server.wgPrivateKey}
Address = ${server.wgAddress.includes('/') ? server.wgAddress : server.wgAddress + '/24'}
ListenPort = ${server.wgListenPort}
`;

	for (const peer of peers) {
		config += `
[Peer]
PublicKey = ${peer.wgPublicKey}
AllowedIPs = ${peer.wgAddress}
PreSharedKey = ${peer.wgPresharedKey}
`;
	}

	return config;
};

export const generatePeerConfig = async (peer: Peer) => {
	const server = await db.query.serverPeersTable.findFirst({
		where: eq(serverPeersTable.id, peer.serverPeerId),
	});

	if (!server) {
		throw new Error('Server not found.');
	}

	return `[Interface]
PrivateKey = ${peer.wgPrivateKey}
Address = ${peer.wgAddress.includes('/') ? peer.wgAddress : peer.wgAddress + '/24'}

[Peer]
PublicKey = ${server.wgPublicKey}
EndPoint = ${server.wgEndpoint}
AllowedIPs = ${server.cidrRange}
PreSharedKey = ${peer.wgPresharedKey}
PersistentKeepalive = 25
`;
};

const copyCidrRange = (cidrRange: string, ipAdress: string) => {
	const cidr = cidrRange.split('/')[1];
	return `${ipAdress}/${cidr}`;
};
