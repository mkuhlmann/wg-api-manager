import { $ } from 'bun';
import {
	peersTable,
	ServerPeer,
	serverPeersTable,
	type Peer,
} from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

export const wgGenKey = async () => {
	return (await $`wg genkey`.text()).trim();
};

export const wgGenPsk = async () => {
	return (await $`wg genpsk`.text()).trim();
};

export const wgDerivePublicKey = async (privateKey: string) => {
	return (await $`wg pubkey < ${new Response(privateKey)}`.text()).trim();
};

const cmd = async (cmd: string) => {
	if (process.env.NODE_ENV === 'development') {
		return `⚙️ ${cmd}`;
	}
	return (await $`${cmd}`.text()).trim();
};

export const startServer = async (server: ServerPeer) => {
	Bun.write(
		'/tmp/' + server.interfaceName + '.conf',
		await generateServerConfig(server)
	);
	cmd(`wg-quick up /tmp/${server.interfaceName}.conf`);
};

export const reloadServer = async (server: ServerPeer) => {
	Bun.write(
		'/tmp/' + server.interfaceName + '.conf',
		await generateServerConfig(server)
	);

	cmd(
		`wg syncconf ${server.interfaceName} <(wq-quick strip /tmp/${server.interfaceName}.conf)`
	);
};

export const stopServer = async (server: ServerPeer) => {
	cmd(`wg-quick down ${server.interfaceName}`);
};

export const generateServerConfig = async (server: ServerPeer) => {
	const peers = await db.query.peersTable.findMany({
		where: eq(peersTable.serverPeerId, server.id),
	});

	let config = `[Interface]
PrivateKey = ${server.wgPrivateKey}
Address = ${
		server.wgAddress.includes('/')
			? server.wgAddress
			: server.wgAddress + '/24'
	}
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
Address = ${
		peer.wgAddress.includes('/') ? peer.wgAddress : peer.wgAddress + '/24'
	}

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
