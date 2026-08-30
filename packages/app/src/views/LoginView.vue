<template>
	<div class="flex items-center justify-center pt-16">
		<div class="w-full max-w-sm border border-border rounded-sm bg-surface2 p-6">
			<div class="text-xs uppercase tracking-wide text-muted mb-4">authenticate</div>
			<h1 class="text-lg font-bold text-accent mb-6">wg-api-manager</h1>
			<form @submit.prevent="handleLogin" class="flex flex-col gap-4">
				<div>
					<label for="token" class="block text-sm text-muted mb-1.5"><span class="text-accent-dim">&gt;</span> administration token</label>
					<BaseInput id="token" v-model="password" type="password" placeholder="paste token" required />
				</div>
				<BaseButton type="submit" :loading="loggingIn" class="w-full">login</BaseButton>
			</form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BaseInput from '@app/components/BaseInput.vue';
import BaseButton from '@app/components/BaseButton.vue';
import { useAuthStore } from '@app/stores/auth';
import { useToast } from '@app/composables/useToast';
import { useRouter } from 'vue-router';

const password = ref('');
const loggingIn = ref(false);
const { add: addToast } = useToast();
const authStore = useAuthStore();
const router = useRouter();

async function handleLogin() {
	loggingIn.value = true;
	try {
		if (await authStore.login(password.value)) {
			router.push('/servers');
		} else {
			addToast({
				severity: 'error',
				summary: 'Login error',
				detail: 'Invalid token',
			});
		}
	} finally {
		loggingIn.value = false;
	}
}
</script>
