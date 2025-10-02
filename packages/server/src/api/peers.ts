import { Elysia, status, t } from 'elysia';
import { db } from '@server/db';
import { peersTable } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { auth } from './auth';
import { createLog } from '@server/lib/log';
import { generatePeerConfig } from '@server/wg/config';

const log = createLog('http');

export const peersRoutes = new Elysia().use(auth).get(
	'/wg/peers/:id/config',
	async ({ params }) => {
		const peer = await db.query.peersTable.findFirst({
			where: and(eq(peersTable.id, params.id)),
		});

		if (!peer) {
			return status(404, 'Peer not found');
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
