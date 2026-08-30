import { describe, expect, it } from 'bun:test';
import { buildRuleset, type FirewallGroup, type FirewallServer } from './firewall';

const group = (overrides: Partial<FirewallGroup> & Pick<FirewallGroup, 'id'>): FirewallGroup => ({
	name: overrides.id,
	allowServer: false,
	allowInternet: false,
	memberIps: [],
	dstGroupIds: [],
	dstCidrs: [],
	...overrides,
});

const server = (overrides: Partial<FirewallServer> = {}): FirewallServer => ({
	interfaceName: 'wg0',
	cidrRange: '10.20.20.0/24',
	wgAddress: '10.20.20.1',
	enableNat: false,
	groups: [],
	...overrides,
});

describe('buildRuleset', () => {
	it('wraps every ruleset in the atomic create/delete/recreate idiom', () => {
		const ruleset = buildRuleset([]);
		expect(ruleset).toStartWith('table inet wgmgr {}\ndelete table inet wgmgr\ntable inet wgmgr {\n');
	});

	it('emits no src_* chains, no group-driven drops, and no jumps when no groups exist anywhere', () => {
		const ruleset = buildRuleset([server()]);

		expect(ruleset).not.toContain('src_');
		expect(ruleset).not.toContain('jump');
		expect(ruleset).not.toContain('chain input');
		expect(ruleset).not.toContain('chain postrouting');
		expect(ruleset).toContain('chain forward {');
		expect(ruleset).toContain('ct state established,related accept');
		// only the baseline invalid-state drop is present - no group/egress drops
		expect(ruleset.match(/\bdrop\b/g)).toEqual(['drop']);
	});

	it('emits a member set and a jump chain for a group with members', () => {
		const g = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2', '10.20.20.5'] });
		const ruleset = buildRuleset([server({ groups: [g] })]);

		expect(ruleset).toContain('set s0g0 {');
		expect(ruleset).toContain('elements = { 10.20.20.2, 10.20.20.5 }');
		expect(ruleset).toContain('comment "office"');
		expect(ruleset).toContain('chain fwd_s0 {');
		expect(ruleset).toContain('ip saddr @s0g0 jump src_s0g0');
		expect(ruleset).toContain('chain src_s0g0 {');
		// no rules granted -> the group's own chain ends in an unconditional drop
		expect(ruleset).toMatch(/chain src_s0g0 \{[\s\S]*\n\s*drop\n\s*\}/);
	});

	it('does not emit an elements line for an empty group', () => {
		const empty = group({ id: 'g-empty', name: 'empty' });
		const withMembers = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'] });
		const ruleset = buildRuleset([server({ groups: [empty, withMembers] })]);

		expect(ruleset).not.toContain('elements = {  }');
		expect(ruleset).not.toContain('elements = { }');
		expect(ruleset).toMatch(/set s0g0 \{\s*\n\s*type ipv4_addr\s*\n\s*comment "empty"\s*\n\s*\}/);
	});

	it('scopes sets and chains per-server, even with overlapping CIDRs', () => {
		const officeA = group({ id: 'a-office', name: 'office', memberIps: ['10.0.0.2'] });
		const officeB = group({ id: 'b-office', name: 'office', memberIps: ['10.0.0.2'] }); // same ip, different server
		const ruleset = buildRuleset([server({ interfaceName: 'wg0', cidrRange: '10.0.0.0/24', groups: [officeA] }), server({ interfaceName: 'wg1', cidrRange: '10.0.0.0/24', groups: [officeB] })]);

		expect(ruleset).toContain('iifname "wg0" jump fwd_s0');
		expect(ruleset).toContain('iifname "wg1" jump fwd_s1');
		expect(ruleset).toContain('set s0g0 {');
		expect(ruleset).toContain('set s1g0 {');
		expect(ruleset).toContain('chain fwd_s0 {');
		expect(ruleset).toContain('chain fwd_s1 {');
	});

	it('grants a directional group -> group rule without granting the reverse', () => {
		const db = group({ id: 'g-db', name: 'db', memberIps: ['10.20.20.9'] });
		const office = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], dstGroupIds: ['g-db'] });
		const ruleset = buildRuleset([server({ groups: [office, db] })]);

		expect(ruleset).toContain('ip daddr @s0g1 accept');
		// only office (s0g0) was granted db (s0g1) as a destination - the reverse
		// accept (db -> office) must not appear anywhere in the ruleset
		expect(ruleset).not.toContain('ip daddr @s0g0 accept');
	});

	it('denies intra-group traffic unless the diagonal rule is explicitly set', () => {
		const office = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2', '10.20.20.3'] });
		const withoutDiagonal = buildRuleset([server({ groups: [office] })]);
		expect(withoutDiagonal).not.toContain('ip daddr @s0g0 accept');

		const withDiagonal = buildRuleset([server({ groups: [{ ...office, dstGroupIds: ['g-office'] }] })]);
		expect(withDiagonal).toContain('ip daddr @s0g0 accept');
	});

	it('allows a dstCidr target', () => {
		const office = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], dstCidrs: ['192.168.50.0/24'] });
		const ruleset = buildRuleset([server({ groups: [office] })]);

		expect(ruleset).toContain('ip daddr 192.168.50.0/24 accept');
	});

	it('drops an ipv6 dstCidr rather than emitting an invalid `ip daddr <ipv6>` line', () => {
		// regression: `ip daddr` is the ipv4-specific match - handing it an ipv6
		// literal is an nft type error (`nft -f` exits 1), not something nft
		// tolerates. A stray ipv6 rule must not be able to break every future sync.
		const office = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], dstCidrs: ['fd00::/64', '192.168.50.0/24'] });
		const ruleset = buildRuleset([server({ groups: [office] })]);

		expect(ruleset).not.toContain('fd00::');
		expect(ruleset).toContain('ip daddr 192.168.50.0/24 accept');
	});

	it('routes grouped traffic to the input chain only when allowServer is set', () => {
		const withAccess = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], allowServer: true });
		const ruleset = buildRuleset([server({ groups: [withAccess] })]);

		expect(ruleset).toContain('chain input {');
		expect(ruleset).toContain('iifname "wg0" ip saddr @s0_restricted jump in_s0');
		expect(ruleset).toMatch(/chain in_s0 \{\s*\n\s*ip saddr @s0g0 accept\s*\n\s*drop\s*\n\s*\}/);
	});

	it('drops grouped restricted traffic at the gateway when allowServer is not set', () => {
		const noAccess = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], allowServer: false });
		const ruleset = buildRuleset([server({ groups: [noAccess] })]);

		expect(ruleset).toMatch(/chain in_s0 \{\s*\n\s*drop\s*\n\s*\}/);
	});

	it('allows internet egress only for groups with allowInternet, scoped to non-managed interfaces', () => {
		const withInternet = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], allowInternet: true });
		const ruleset = buildRuleset([server({ interfaceName: 'wg0', groups: [withInternet] })]);

		expect(ruleset).toContain('oifname != { "wg0" } accept');
	});

	it('does not add a postrouting/masquerade chain when enableNat is off', () => {
		const g = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], allowInternet: true });
		const ruleset = buildRuleset([server({ groups: [g], enableNat: false })]);

		expect(ruleset).not.toContain('chain postrouting');
		expect(ruleset).not.toContain('masquerade');
	});

	it('adds a scoped masquerade rule when enableNat is on', () => {
		const g = group({ id: 'g-office', name: 'office', memberIps: ['10.20.20.2'], allowInternet: true });
		const ruleset = buildRuleset([server({ cidrRange: '10.20.20.0/24', interfaceName: 'wg0', groups: [g], enableNat: true })]);

		expect(ruleset).toContain('chain postrouting {');
		expect(ruleset).toContain('ip saddr 10.20.20.0/24 oifname != { "wg0" } masquerade');
	});

	it('blocks an ungrouped peer from internet egress once NAT is enabled anywhere, without touching peer-to-peer reachability', () => {
		// no groups at all, but NAT is on - the egress guard must still appear so
		// ungrouped peers don't get free internet access as a side effect.
		const ruleset = buildRuleset([server({ enableNat: true })]);

		expect(ruleset).toContain('iifname { "wg0" } oifname != { "wg0" } drop');
	});

	it('omits the egress guard entirely when no server has NAT on (true no-op for untouched deployments)', () => {
		const ruleset = buildRuleset([server({ enableNat: false }), server({ interfaceName: 'wg1', enableNat: false })]);

		expect(ruleset).not.toContain('oifname !=');
		// only the baseline invalid-state drop is present - no egress guard drop
		expect(ruleset.match(/\bdrop\b/g)).toEqual(['drop']);
	});
});
