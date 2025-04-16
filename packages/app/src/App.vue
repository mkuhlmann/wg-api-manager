<script setup lang="ts">
import { Toast } from 'primevue';
import { RouterLink, RouterView } from 'vue-router';
import { ref } from 'vue';
</script>

<template>
	<div class="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
		<nav class="flex gap-5 dark:bg-neutral-900 text-lg items-center px-4 py-2 shadow-md backdrop-blur-md bg-opacity-80 border-b border-sky-800/40">
			<div class="font-extralight text-sky-400 text-2xl tracking-tight ml-2 flex items-center gap-2">
				<span>wg-api-manager</span>
			</div>
			<RouterLink to="/servers" class="nav-link">Servers</RouterLink>
			<RouterLink to="/stats" class="nav-link">Stats</RouterLink>
		</nav>

		<div class="flex-1">
			<Toast />
			<RouterView />
		</div>
	</div>
</template>

<style scoped>
nav {
	background: linear-gradient(90deg, #1e293b 0%, #334155 100%);
	box-shadow: 0 4px 24px 0 rgba(30, 41, 59, 0.15);
}
.nav-link {
	padding: 0.75rem 1.25rem;
	border-radius: 0.5rem;
	color: #cbd5e1;
	font-weight: 500;
	transition: color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.2s;
	position: relative;
	overflow: hidden;
}
.nav-link::after {
	content: '';
	display: block;
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%) scaleX(0);
	width: 80%;
	height: 2px;
	background: linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%);
	transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	border-radius: 1px;
}
.nav-link:hover,
.nav-link.router-link-exact-active {
	color: #38bdf8;
	background: rgba(14, 165, 233, 0.08);
	box-shadow: 0 2px 8px 0 rgba(56, 189, 248, 0.1);
	border-radius: 0;
}
.nav-link:hover::after,
.nav-link.router-link-exact-active::after {
	transform: translateX(-50%) scaleX(1);
}
</style>
