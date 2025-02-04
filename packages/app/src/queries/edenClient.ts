import { useAuthStore } from '@app/stores/auth';
import { treaty, type Treaty } from '@elysiajs/eden';
import type { App } from '@server/index';

export const eden = treaty<App>(`${location.host}`, {
	headers(path, options) {
		const authStore = useAuthStore();
		if (authStore.authTokenValidated) {
			return {
				authorization: `Bearer ${authStore.authToken}`,
			};
		}
	},
	fetcher: async (url, options) => {
		const response = await fetch(url, options);
		if (response.status >= 400) {
			const clone = response.clone();
			const data = await clone.json();
			throw data;
		}
		return response;
	},
});

export const api = eden.api.v1;
