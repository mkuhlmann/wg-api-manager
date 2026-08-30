<template>
	<div class="crt-scanlines min-h-screen bg-bg text-text">
		<nav class="flex items-center gap-6 px-4 py-3 border-b border-border">
			<RouterLink to="/servers" class="font-bold text-accent tracking-tight flex items-center gap-1">
				<span class="text-muted font-normal">#</span>wg-api-manager
			</RouterLink>
			<RouterLink to="/servers" class="nav-link">servers</RouterLink>
		</nav>

		<main class="px-6 py-8">
			<RouterView />
		</main>

		<ToastStack />
	</div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import ToastStack from '@app/components/ToastStack.vue';
</script>

<style scoped>
.nav-link {
	color: var(--color-muted);
	font-size: 0.85rem;
	text-decoration: none;
	border-bottom: 1px solid transparent;
	padding-bottom: 2px;
	transition:
		color 0.15s,
		border-color 0.15s;
}
.nav-link:hover,
.nav-link.active {
	color: var(--color-accent);
	border-color: var(--color-accent);
}
</style>
