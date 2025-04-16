<template>
	<div class="flex items-center justify-center mt-10">
		<div class="shadow-2xl bg-neutral-100 dark:bg-gray-800 p-8 w-full max-w-xl flex flex-col gap-6">
			<h1 class="text-3xl font-thin text-center text-sky-500 mb-2 tracking-tight drop-shadow">wg-api-manager</h1>
			<form @submit.prevent="handleLogin" class="flex flex-col gap-4">
				<div>
					<Password v-model="password" placeholder="Administration Token" :feedback="false" toggleMask class="w-full" />
				</div>
				<Button label="Login" class="w-full px-4 py-2 text-lg" @click="handleLogin" />
			</form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { api } from '@app/queries/edenClient';
import { useAuthStore } from '@app/stores/auth';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';

const password = ref('');
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();

async function handleLogin() {
	if (await authStore.login(password.value)) {
		router.push('/servers');
	} else {
		toast.add({
			severity: 'error',
			summary: 'Login Error',
			detail: 'Invalid token',
			life: 3000,
		});
	}
}
</script>

<style scoped>
:deep(.p-password),
:deep(.p-password-input) {
	width: 100%;
}
</style>
