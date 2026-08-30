import { db } from '@server/db';
import { peerGroupRulesTable, peerGroupsTable, peersTable, serverPeersTable } from '@server/db/schema';
import { createLog } from '@server/lib/log';
import { eq } from 'drizzle-orm';
import { applyFirewall } from './shell';

const log = createLog('wg:firewall');

export type FirewallGroup = {
	id: string;
	name: string;
	allowServer: boolean;
	allowInternet: boolean;
	memberIps: string[];
	dstGroupIds: string[];
	dstCidrs: string[];
};

export type FirewallServer = {
	interfaceName: string;
	cidrRange: string;
	wgAddress: string;
	enableNat: boolean;
	groups: FirewallGroup[];
};

// nft identifiers must start with a letter and only accept a limited charset. nanoid
// ids and interfaceName (validated only by /^[a-zA-Z0-9_=+.-]{1,15}$/, which admits
// `=` and `+`) don't satisfy that, so objects are named by stable ordinal position
// instead - the human name still appears as an nft `comment` for readability.
const sanitizeComment = (value: string) => value.replace(/[\\"\r\n]/g, '').slice(0, 64);

// This feature is ipv4-only throughout (see the `meta nfproto ipv6 drop` above).
// `ip daddr <cidr>` is the ipv4-specific match - handing it an ipv6 literal is an
// nft type error (`nft -f` exits 1: "Address family for hostname not supported"),
// not something nft just ignores. Used both to gate the api (`groups.ts`) and,
// defensively, here - a dstCidr already in the db (e.g. from before this check
// existed) must not be able to permanently break every future sync.
export const isIpv4Cidr = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[1-2][0-9]|3[0-2])$/.test(value);

const quote = (value: string) => `"${value}"`;

/**
 * Pure ruleset builder - no db, no io. Takes an explicit, ordered list of servers
 * (ordinal position determines the generated nft names, so callers must pass a
 * stable order) and returns the full `table inet wgmgr` nft script as text.
 */
export const buildRuleset = (servers: FirewallServer[]): string => {
	const allInterfaces = [...new Set(servers.map((s) => s.interfaceName))];
	const managedIfaceSet = allInterfaces.length ? `{ ${allInterfaces.map(quote).join(', ')} }` : '{}';

	// resolve a group's db id -> its ordinal `s{i}g{j}` name, across all servers
	const groupSetName = new Map<string, string>();
	servers.forEach((server, i) => {
		server.groups.forEach((group, j) => {
			groupSetName.set(group.id, `s${i}g${j}`);
		});
	});

	const sets: string[] = [];
	const forwardLines: string[] = [];
	const inputLines: string[] = [];
	const fwdChains: string[] = [];
	const srcChains: string[] = [];
	const inChains: string[] = [];
	const natLines: string[] = [];

	servers.forEach((server, i) => {
		if (server.groups.length === 0) return;

		const restrictedName = `s${i}_restricted`;
		const fwdName = `fwd_s${i}`;
		const inName = `in_s${i}`;

		const restrictedIps = server.groups.flatMap((g) => g.memberIps);
		sets.push(renderSet(restrictedName, restrictedIps));

		forwardLines.push(`\tiifname ${quote(server.interfaceName)} jump ${fwdName}`);
		inputLines.push(`\tiifname ${quote(server.interfaceName)} ip saddr @${restrictedName} jump ${inName}`);

		const fwdBody: string[] = [];
		const inBody: string[] = [];

		server.groups.forEach((group, j) => {
			const setName = `s${i}g${j}`;
			sets.push(renderSet(setName, group.memberIps, group.name));

			fwdBody.push(`\tip saddr @${setName} jump src_${setName}`);

			if (group.allowServer) {
				inBody.push(`\tip saddr @${setName} accept`);
			}

			const srcBody: string[] = [];
			// ipv4-only feature (matches the rest of the codebase - the cidrRange
			// regex is ipv4-only and peers have no v6 address) - drop v6 explicitly
			// rather than silently falling through unfiltered.
			srcBody.push(`\tmeta nfproto ipv6 drop`);

			for (const dstGroupId of group.dstGroupIds) {
				const dstSet = groupSetName.get(dstGroupId);
				if (!dstSet) continue; // dst group not found on this or any server - ignore stale rule
				srcBody.push(`\tip daddr @${dstSet} accept`);
			}

			for (const cidr of group.dstCidrs) {
				if (!isIpv4Cidr(cidr)) continue; // defensive - see isIpv4Cidr comment above
				srcBody.push(`\tip daddr ${cidr} accept`);
			}

			if (group.allowInternet) {
				srcBody.push(`\toifname != ${managedIfaceSet} accept`);
			}

			srcBody.push(`\tdrop`);

			srcChains.push(`chain src_${setName} {\n${srcBody.join('\n')}\n}`);
		});

		fwdBody.push(`\treturn`);
		fwdChains.push(`chain ${fwdName} {\n${fwdBody.join('\n')}\n}`);

		inBody.push(`\tdrop`);
		inChains.push(`chain ${inName} {\n${inBody.join('\n')}\n}`);

		if (server.enableNat) {
			natLines.push(`\tip saddr ${server.cidrRange} oifname != ${managedIfaceSet} masquerade`);
		}
	});

	const parts: string[] = [];

	parts.push(...sets);

	// Safety net: an ungrouped peer falls through `fwd_s{i}`'s `return` (it's
	// unrestricted, matching today's behaviour) and would otherwise hit this base
	// chain's `policy accept` even for traffic leaving via a non-wg interface - i.e.
	// internet/LAN egress, only reachable at all once postrouting can masquerade it
	// (`enableNat`). That capability is new and must stay opt-in per group, so
	// explicitly deny it for any wg-sourced traffic not already accepted by a
	// group's own rules. Only added when some server has NAT on - with NAT off
	// everywhere (the default) such traffic already can't work (no route back), so
	// this stays a true no-op for every deployment that hasn't touched the feature.
	// Peer-to-peer reachability (iif == oif, both managed wg interfaces) is untouched.
	const egressGuard = allInterfaces.length && servers.some((s) => s.enableNat) ? [`\tiifname ${managedIfaceSet} oifname != ${managedIfaceSet} drop`] : [];

	parts.push(
		[
			`chain forward {`,
			`\ttype filter hook forward priority filter; policy accept;`,
			`\tct state invalid drop`,
			`\tct state established,related accept`,
			...forwardLines,
			...egressGuard,
			`}`,
		].join('\n')
	);

	parts.push(...fwdChains);
	parts.push(...srcChains);

	if (inputLines.length) {
		parts.push([`chain input {`, `\ttype filter hook input priority filter; policy accept;`, `\tct state established,related accept`, ...inputLines, `}`].join('\n'));
		parts.push(...inChains);
	}

	if (natLines.length) {
		parts.push([`chain postrouting {`, `\ttype nat hook postrouting priority srcnat; policy accept;`, ...natLines, `}`].join('\n'));
	}

	const body = parts.map((p) => indent(p)).join('\n\n');

	return `table inet wgmgr {}\ndelete table inet wgmgr\ntable inet wgmgr {\n${body}\n}\n`;
};

const renderSet = (name: string, ips: string[], comment?: string) => {
	const lines = [`set ${name} {`, `\ttype ipv4_addr`];
	if (comment) lines.push(`\tcomment ${quote(sanitizeComment(comment))}`);
	if (ips.length) lines.push(`\telements = { ${ips.join(', ')} }`);
	lines.push(`}`);
	return lines.join('\n');
};

const indent = (block: string) =>
	block
		.split('\n')
		.map((line) => (line ? '\t' + line : line))
		.join('\n');

const loadFirewallState = async (): Promise<FirewallServer[]> => {
	const servers = await db.query.serverPeersTable.findMany();

	const result: FirewallServer[] = [];

	for (const server of servers) {
		const groups = await db.query.peerGroupsTable.findMany({ where: eq(peerGroupsTable.serverPeerId, server.id) });
		if (groups.length === 0) {
			result.push({ interfaceName: server.interfaceName, cidrRange: server.cidrRange, wgAddress: server.wgAddress, enableNat: server.enableNat, groups: [] });
			continue;
		}

		const firewallGroups: FirewallGroup[] = [];
		for (const group of groups) {
			const members = await db.query.peersTable.findMany({ where: eq(peersTable.groupId, group.id) });
			const rules = await db.query.peerGroupRulesTable.findMany({ where: eq(peerGroupRulesTable.srcGroupId, group.id) });

			const dstCidrs = rules.filter((r) => r.dstCidr).map((r) => r.dstCidr!);
			for (const cidr of dstCidrs) {
				if (!isIpv4Cidr(cidr)) {
					log.warn(`Group ${group.id} (${group.name}) has a non-ipv4 dstCidr rule "${cidr}" - ignoring it. Remove and re-add the rule via the api/ui to clean it up.`);
				}
			}

			firewallGroups.push({
				id: group.id,
				name: group.friendlyName ?? group.name,
				allowServer: group.allowServer,
				allowInternet: group.allowInternet,
				memberIps: members.map((m) => m.wgAddress),
				dstGroupIds: rules.filter((r) => r.dstGroupId).map((r) => r.dstGroupId!),
				dstCidrs,
			});
		}

		result.push({ interfaceName: server.interfaceName, cidrRange: server.cidrRange, wgAddress: server.wgAddress, enableNat: server.enableNat, groups: firewallGroups });
	}

	return result;
};

export const generateFirewallRuleset = async () => buildRuleset(await loadFirewallState());

/**
 * Regenerates the whole ruleset (it is global across all servers) and applies it
 * atomically. A failed apply leaves the previous ruleset in place - log and move on
 * rather than tearing the table down, since a partial/failed state is worse than a
 * stale-but-consistent one.
 */
export const syncFirewall = async () => {
	try {
		const ruleset = await generateFirewallRuleset();
		await applyFirewall(ruleset);
	} catch (error) {
		log.error(`Failed to sync firewall ruleset: ${error}`);
	}
};
