import { $ } from 'bun';
import { createLog } from '@server/lib/log';
import * as real from './shell.real';
import * as shim from './shell.shim';

const log = createLog('wg');

const override = (process.env.WG_DEV_SHIM ?? '').toLowerCase();
const forceShim = override === 'true' || override === '1';
const forceReal = override === 'false' || override === '0';

const detectCapabilities = async () => {
	if (forceShim) return { crypto: false, network: false };
	if (forceReal) return { crypto: true, network: true };

	const hasCrypto = !!Bun.which('wg');
	let hasNetwork = hasCrypto && !!Bun.which('wg-quick') && !!Bun.which('ip');

	if (hasNetwork) {
		// wg genkey/pubkey/psk need no privileges, but managing interfaces needs
		// NET_ADMIN. Probe that specifically, since the binaries can be present
		// without the permission (e.g. an unprivileged dev container).
		const probe = `wgshimprobe${process.pid}`;
		const add = await $`ip link add dev ${probe} type dummy`.quiet().nothrow();
		hasNetwork = add.exitCode === 0;
		await $`ip link delete dev ${probe}`.quiet().nothrow();
	}

	return { crypto: hasCrypto, network: hasNetwork };
};

const capabilities = await detectCapabilities();

if (!capabilities.crypto || !capabilities.network) {
	if (process.env.NODE_ENV === 'production' && !forceShim) {
		throw new Error(
			'wg/wg-quick/ip are missing or lack permission to manage network interfaces (NET_ADMIN capability required). ' +
				'Refusing to silently fall back to the development shim in production. Set WG_DEV_SHIM=true to override.'
		);
	}
	log.warn(
		`⚠️  WireGuard/network tooling unavailable (crypto: ${capabilities.crypto ? 'real' : 'shimmed'}, interfaces: ${capabilities.network ? 'real' : 'shimmed'}). ` +
			'Running with the development shim — no real tunnels or network changes will be made.'
	);
}

export const wgGenKey = capabilities.crypto ? real.wgGenKey : shim.wgGenKey;
export const wgGenPsk = capabilities.crypto ? real.wgGenPsk : shim.wgGenPsk;
export const wgDerivePublicKey = capabilities.crypto ? real.wgDerivePublicKey : shim.wgDerivePublicKey;

export const wgShow = capabilities.network ? real.wgShow : shim.wgShow;
export const isInterfaceUp = capabilities.network ? real.isInterfaceUp : shim.isInterfaceUp;
export const startServer = capabilities.network ? real.startServer : shim.startServer;
export const reloadServer = capabilities.network ? real.reloadServer : shim.reloadServer;
export const stopServer = capabilities.network ? real.stopServer : shim.stopServer;

export const cmd = real.cmd;
