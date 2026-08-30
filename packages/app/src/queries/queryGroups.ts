import { queryOptions } from '@tanstack/vue-query';
import { api } from './edenClient';

export const queryServerGroups = (id: string) =>
	queryOptions({
		queryKey: ['serverGroups', id],
		queryFn: async () => {
			const resp = await api.wg.servers({ id: id }).groups.get();
			return resp.data ?? [];
		},
	});
