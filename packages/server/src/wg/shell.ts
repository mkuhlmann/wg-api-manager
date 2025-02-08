import { $ } from 'bun';
import { ServerPeer } from '../db/schema';
import { createLog } from '@server/lib/log';

import { exec } from 'child_process';
import { promisify } from 'util';
import { generateServerConfig } from './config';

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
