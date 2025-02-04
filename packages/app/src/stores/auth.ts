import { api } from '@app/queries/edenClient';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAuthStore = defineStore('authStore', () => {
	const authToken = ref<string | null>(null);
	const authTokenValidated = ref<boolean>(false);

	async function login(token: string) {
		try {
			const resp = await api.wg.servers.get({
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (resp.error) {
				throw resp.error.value;
			}
			authToken.value = token;
			authTokenValidated.value = true;
			return true;
		} catch (error) {
			authToken.value = null;
			authTokenValidated.value = false;
			return false;
		}
	}

	function clearAuthToken() {
		authToken.value = null;
		authTokenValidated.value = false;
	}

	async function isAuthenticated() {
		if (authToken.value !== null && !authTokenValidated.value) {
			await login(authToken.value);
		}

		return authToken.value !== null && authTokenValidated.value;
	}

	return {
		authToken,
		login,
		clearAuthToken,
		authTokenValidated,
		isAuthenticated,
	};
});
