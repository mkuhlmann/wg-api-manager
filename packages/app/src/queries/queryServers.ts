import { queryOptions, useQuery } from '@tanstack/vue-query';
import { api } from './edenClient';

export const queryServers = () =>
	queryOptions({
		queryKey: ['servers'],
		queryFn: async () => {
			const resp = await api.wg.servers.get();
			return resp.data ?? [];
		},
	});

export const queryServer = (id: string) =>
	queryOptions({
		queryKey: ['server', id],
		queryFn: async () => {
			const resp = await api.wg.servers({ id: id }).get();
			return resp.data;
		},
	});

export const queryServerPeers = (id: string) =>
	queryOptions({
		queryKey: ['serverPeers', id],
		queryFn: async () => {
			const resp = await api.wg.servers({ id: id }).peers.get();
			return resp.data;
		},
	});
