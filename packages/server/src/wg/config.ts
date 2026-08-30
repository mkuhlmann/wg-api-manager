import { db } from '@server/db';
import { peerGroupRulesTable, peerGroupsTable, peersTable, serverPeersTable, type Peer, type ServerPeer } from '@server/db/schema';
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
`;
		if (peer.wgPresharedKey) {
			config += `PreSharedKey = ${peer.wgPresharedKey}\n`;
		}
	}

	return config;
};

/**
 * Client-side AllowedIPs is a routing hint, not the enforcement boundary - the
 * server's nft ruleset (see wg/firewall.ts) is what actually decides reachability.
 * A client can't reach an allowed subnet or the internet unless its own config
 * routes that traffic into the tunnel in the first place, so this still has to
 * reflect the peer's group grant. Peers reachable via a dstGroupId rule need no
 * extra entry here - they're other peers on the same server.cidrRange, already
 * covered by the base entry.
 */
const computeClientAllowedIps = async (peer: Peer, server: ServerPeer) => {
	if (!peer.groupId) return server.cidrRange;

	const group = await db.query.peerGroupsTable.findFirst({ where: eq(peerGroupsTable.id, peer.groupId) });
	if (!group) return server.cidrRange; // stale reference (shouldn't happen - fk sets peer.groupId null on group delete)

	if (group.allowInternet) return '0.0.0.0/0';

	const rules = await db.query.peerGroupRulesTable.findMany({ where: eq(peerGroupRulesTable.srcGroupId, group.id) });
	const extraCidrs = rules.filter((r) => r.dstCidr).map((r) => r.dstCidr!);

	return [server.cidrRange, ...extraCidrs].join(', ');
};

export const generatePeerConfig = async (peer: Peer) => {
	const server = await db.query.serverPeersTable.findFirst({
		where: eq(serverPeersTable.id, peer.serverPeerId),
	});

	if (!server) {
		throw new Error('Server not found.');
	}

	const allowedIps = await computeClientAllowedIps(peer, server);

	let config = `[Interface]
PrivateKey = ${peer.wgPrivateKey}
Address = ${peer.wgAddress.includes('/') ? peer.wgAddress : peer.wgAddress + '/32'}

[Peer]
PublicKey = ${server.wgPublicKey}
Endpoint = ${server.wgEndpoint}
AllowedIPs = ${allowedIps}
`;

	if (peer.wgPresharedKey) {
		config += `PreSharedKey = ${peer.wgPresharedKey}\n`;
	}

	config += `PersistentKeepalive = 25\n`;

	return config;
};
