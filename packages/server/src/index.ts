import { Elysia } from 'elysia';
import swagger from '@elysiajs/swagger';
import staticPlugin from '@elysiajs/static';
import { createLog } from './lib/log';
import { auth } from './api/auth';
import { serversRoutes } from './api/servers';
import { peersRoutes } from './api/peers';
import { wgManager } from './wg/manager';
import { serversPeersRoute } from './api/serversPeers';
import { migrateDb } from './db';
import { nanoid } from 'nanoid';

const httpLog = createLog('http');
const log = createLog('core');

const _app = new Elysia()
	.use(
		swagger({
			documentation: {
				info: {
					title: 'wg-api-manager',
					version: '1.0.0',
				},
				components: {
					securitySchemes: {
						bearerAuth: {
							type: 'http',
							scheme: 'bearer',
						},
					},
				},
			},
		})
	)
	.onBeforeHandle(({ request, server }) => {
		httpLog.info(`${request.method} ${request.url} ${server?.requestIP(request)?.address}`);
	})
	.use(auth)
	.group('/api/v1', (app) => app.use(serversRoutes).use(serversPeersRoute).use(peersRoutes))
	.use(
		staticPlugin({
			indexHTML: true,
			assets: '../app/dist',
			prefix: '',
		})
	);

const main = async () => {
	if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 16) {
		log.error('ADMIN_TOKEN is not set or too short, generating temporary token');
		process.env.ADMIN_TOKEN = nanoid(32);
		log.info(`Generated token: ${process.env.ADMIN_TOKEN}`);
	}

	log.info('Migrating database');
	await migrateDb();

	log.info('Starting wireguard manager');
	wgManager.start();

	log.info('Starting http server');
	_app.listen(3000);

	httpLog.info(`api ist running at ${_app.server?.hostname}:${_app.server?.port}`);
};

main();

export type App = typeof _app;
