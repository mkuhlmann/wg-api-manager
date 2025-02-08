import { Elysia, t } from 'elysia';
import { db } from '../db';
import { Peer, peersTable, serverPeersTable } from '../db/schema';
import IPCIDR from 'ip-cidr';
import { eq, and, or } from 'drizzle-orm';
import { generatePeerConfig, reloadServer, wgDerivePublicKey, wgGenKey, wgGenPsk } from '../wg/wg';
import { wgManager } from '../wg/manager';
import { auth } from './auth';
import { createLog } from '@server/lib/log';

const log = createLog('http');

export const peersRoutes = new Elysia().use(auth).get(
	'/wg/peers/:id/config',
	async ({ params }) => {
		const peer = await db.query.peersTable.findFirst({
			where: and(eq(peersTable.id, params.id)),
		});

		if (!peer) {
			throw new Error('Peer not found');
		}

		return generatePeerConfig(peer);
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		verifyAuth: { scope: 'peer' },
	}
);
