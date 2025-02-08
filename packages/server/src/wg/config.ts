import { db } from '@server/db';
import { Peer, peersTable, ServerPeer, serverPeersTable } from '@server/db/schema';
import { eq } from 'drizzle-orm';

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
