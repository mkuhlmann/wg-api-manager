import { $, ShellOutput } from 'bun';
import { peersTable, ServerPeer, serverPeersTable, type Peer } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { createLog } from '@server/lib/log';

const log = createLog('wg');

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
	Bun.write('/tmp/' + server.interfaceName + '.conf', await generateServerConfig(server));
	await $`wg-quick up /tmp/${server.interfaceName}.conf`;
};

export const reloadServer = async (server: ServerPeer) => {
	Bun.write('/tmp/' + server.interfaceName + '.conf', await generateServerConfig(server));

	await $`wg syncconf ${server.interfaceName} <(wq-quick strip /tmp/${server.interfaceName}.conf)`;
};

export const stopServer = async (server: ServerPeer) => {
	//await $`wg-quick down ${server.interfaceName}`;
	await $`ip link delete dev ${server.interfaceName}`;
};

export const generateServerConfig = async (server: ServerPeer) => {
	const peers = await db.query.peersTable.findMany({
		where: eq(peersTable.serverPeerId, server.id),
	});

	let config = `[Interface]
PrivateKey = ${server.wgPrivateKey}
Address = ${server.wgAddress.includes('/') ? server.wgAddress : server.wgAddress + '/24'}
ListenPort = ${server.wgListenPort}`;

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
