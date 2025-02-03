import Elysia from 'elysia';
import { db } from '../db';
import { peersTable, serverPeersTable } from '../db/schema';
import { and, eq } from 'drizzle-orm';

export const auth = new Elysia({ name: 'auth' }).macro({
	verifyAuth(config: { scope?: 'admin' | 'server' | 'peer' }) {
		if (!config.scope) {
			config.scope = 'admin';
		}

		return {
			async beforeHandle({ headers, params, error }) {
				if (!headers.authorization) {
					throw error(401);
				}

				const token = headers.authorization.split(' ')[1];

				if (token === process.env.ADMIN_TOKEN) {
					return;
				}

				const id = params.id;
				if (config.scope == 'server' && id) {
					const server = await db.query.serverPeersTable.findFirst({
						where: and(
							eq(serverPeersTable.id, id),
							eq(serverPeersTable.authToken, token)
						),
					});

					if (server) {
						return;
					}
				}

				if (config.scope == 'peer' && id) {
					const peer = await db.query.peersTable.findFirst({
						where: and(
							eq(peersTable.id, id),
							eq(peersTable.authToken, token)
						),
					});

					if (peer) {
						return;
					}
				}

				throw error(401);
			},
		};
	},
});
