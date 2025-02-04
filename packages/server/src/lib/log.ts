import pino from 'pino';

export const log = pino({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
		},
	},
});

export const createLog = (name: string) => log.child({}, { msgPrefix: `[${name}] ` });
