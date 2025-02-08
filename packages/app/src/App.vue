<script setup lang="ts">
import { Toast } from 'primevue';
import { RouterLink, RouterView } from 'vue-router';
import { ref } from 'vue';
</script>

<template>
	<nav class="flex gap-5 dark:bg-neutral-900 text-lg items-center">
		<div class="font-bold ml-5">wg-api-manager</div>
		<RouterLink to="/servers" class="p-4 hover:bg-neutral-800 transition-colors">Servers</RouterLink>
		<RouterLink to="/stats" class="p-4 hover:bg-neutral-800 transition-colors">Stats</RouterLink>
	</nav>
	<div class="md:m-5">
		<Toast />
		<RouterView />
	</div>
</template>

<style></style>
