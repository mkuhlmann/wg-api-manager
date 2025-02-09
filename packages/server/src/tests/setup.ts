process.env.DATABASE_PATH = ':memory:';

import { migrateDb } from '@server/db';
import { mock } from 'bun:test';

await migrateDb();

process.env.ADMIN_TOKEN = 'adminToken';

mock.module('@server/wg/shell', () => {
	return {
		cmd: async (command: string) => {
			return { stdout: 'mocked stdout', stderr: '' };
		},
		wgGenKey: async () => 'mockedPrivateKey',
		wgGenPsk: async () => 'mockedPsk',
		wgDerivePublicKey: async (privateKey: string) => 'mockedPublicKey',
		wgShow: async (interfaceName: string) => {
			return {
				interface: {
					privateKey: 'mockedPrivateKey',
					publicKey: 'mockedPublicKey',
					listenPort: 'mockedPort',
					fwmark: 'mockedFwmark',
				},
				peers: [],
			};
		},
		isInterfaceUp: async (interfaceName: string) => true,
		startServer: async (server: any) => {
			/* mocked startServer */
		},
		reloadServer: async (server: any) => {
			/* mocked reloadServer */
		},
		stopServer: async (server: any) => {
			/* mocked stopServer */
		},
	};
});
