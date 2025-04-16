<template>
	<div class="px-8 py-6">
		<div v-if="isLoading" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
			<div class="flex flex-col items-center gap-4">
				<svg class="animate-spin h-12 w-12 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
				</svg>
				<span class="text-white text-lg font-semibold">Loading servers...</span>
			</div>
		</div>
		<div class="flex gap-5 items-center mb-8">
			<h1 class="text-3xl font-thin tracking-tight text-white drop-shadow">Servers</h1>
			<Button label="Add Server" @click="showAddModal = true" class="!bg-blue-600 hover:!bg-blue-700 text-white font-semibold shadow-lg rounded-lg px-4 py-2 flex items-center gap-2">
				<Icon class="w-5 h-5"><AddIcon /></Icon>
			</Button>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
			<div v-for="server in servers" :key="server.id" class="">
				<Card class="!rounded-none shadow-xl !bg-gray-800 hover:scale-105 transition-transform duration-200">
					<template #title>
						<span class="text-lg font-thin text-sky-500 flex items-center gap-2">
							{{ server.friendlyName ?? server.id }}
						</span>
					</template>
					<template #content>
						<table class="w-full text-sm text-gray-300">
							<tbody>
								<tr>
									<td class="font-semibold pr-2">Id</td>
									<td class="truncate">{{ server.id }}</td>
								</tr>
								<tr>
									<td class="font-semibold pr-2">Endpoint</td>
									<td class="truncate">{{ server.wgEndpoint }}</td>
								</tr>
							</tbody>
						</table>
					</template>
					<template #footer>
						<div class="flex gap-3 mt-4">
							<Button as="router-link" :to="'/servers/' + server.id" label="View" class="w-full rounded-lg shadow" />
							<Button @click="editServer(server)" class="rounded-lg shadow flex items-center justify-center">
								<Icon class="w-5 h-5"><EditIcon /></Icon>
							</Button>
						</div>
					</template>
				</Card>
			</div>
		</div>
	</div>

	<ServerModal v-model:visible="showAddModal" />
	<ServerModal v-model:visible="showEditModal" :server="selectedServer" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { queryServers } from '@app/queries/queryServers';
import { useQuery } from '@tanstack/vue-query';
import { Button, Card } from 'primevue';
import ServerModal from '@app/components/ServerModal.vue';
import type { ServerPeer } from '@server/db/schema';

import { Icon } from '@vicons/utils';
import AddIcon from '@vicons/carbon/AddAlt';
import EditIcon from '@vicons/carbon/Edit';

const { data: servers, isLoading } = useQuery(queryServers());
const showAddModal = ref(false);
const showEditModal = ref(false);
const selectedServer = ref<ServerPeer>();

const editServer = (server: ServerPeer) => {
	selectedServer.value = server;
	showEditModal.value = true;
};
</script>

<style scoped>
.table-definition td {
	padding: 0.5rem;
}

/* Modern card and button styles */
:deep(.p-card) {
	background: transparent;
	border: none;
	box-shadow: none;
}
:deep(.p-button) {
	border-radius: 0.75rem;
	font-weight: 600;
	transition: background 0.2s, color 0.2s;
}
</style>
