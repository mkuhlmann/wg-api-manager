<template>
	<div class="">
		<div class="flex items-center justify-center">
			<div class="shadow-2xl bg-neutral-100 dark:bg-neutral-900 p-5 rounded-lg w-[600px]">
				<h1 class="text-2xl font-bold text-center mb-4">wg-manager</h1>
				<form @submit.prevent="handleLogin">
					<div class="mb-4">
						<Password v-model="password" placeholder="Adminstration Token" :feedback="false" toggleMask />
					</div>
					<Button label="Login" class="w-full" @click="handleLogin" />
				</form>
			</div>
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

<style>
.p-password,
.p-password-input {
	width: 100%;
}
</style>
