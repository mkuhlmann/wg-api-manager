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

		<div class="flex flex-col gap-8">
			<div class="flex justify-between items-center">
				<h1 class="text-3xl font-thin tracking-tight text-white drop-shadow">Servers</h1>
				<BaseButton @click="showAddModal = true">
					<template #icon-left>
						<Icon class="w-5 h-5"><AddIcon /></Icon>
					</template>
					Add Server
				</BaseButton>
			</div>

			<DataView :items="servers || []" :filter-fields="['id', 'friendlyName', 'wgEndpoint']" default-layout="grid">
				<template #grid-item="{ item: server }">
					<BaseCard :title="server.friendlyName ?? server.id" class="h-full flex flex-col">
						<template #header>
							<div class="flex items-center gap-2 text-sky-500">
								<span class="text-lg font-thin truncate">{{ server.friendlyName ?? server.id }}</span>
							</div>
						</template>

						<div class="flex-1">
							<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-gray-300">
								<span class="font-semibold text-gray-500">ID</span>
								<span class="truncate font-mono">{{ server.id }}</span>

								<span class="font-semibold text-gray-500">Endpoint</span>
								<span class="truncate font-mono">{{ server.wgEndpoint }}</span>
							</div>
						</div>

						<template #footer>
							<div class="flex gap-3">
								<BaseButton as="router-link" :to="'/servers/' + server.id" variant="secondary" class="flex-1"> View </BaseButton>
								<BaseButton @click="editServer(server)" variant="ghost" class="px-3!">
									<Icon class="w-5 h-5"><EditIcon /></Icon>
								</BaseButton>
							</div>
						</template>
					</BaseCard>
				</template>

				<template #table-header>
					<th class="px-6 py-3">Name/ID</th>
					<th class="px-6 py-3">Endpoint</th>
					<th class="px-6 py-3 text-right">Actions</th>
				</template>

				<template #table-row="{ item: server }">
					<td class="px-6 py-4 font-medium text-white">
						{{ server.friendlyName ?? server.id }}
					</td>
					<td class="px-6 py-4 font-mono text-gray-400">
						{{ server.wgEndpoint }}
					</td>
					<td class="px-6 py-4 text-right">
						<div class="flex justify-end gap-2">
							<BaseButton as="router-link" :to="'/servers/' + server.id" variant="secondary" size="sm"> View </BaseButton>
							<BaseButton @click="editServer(server)" variant="ghost" size="sm">
								<Icon class="w-4 h-4"><EditIcon /></Icon>
							</BaseButton>
						</div>
					</td>
				</template>
			</DataView>
		</div>
	</div>

	<ServerModal v-model:visible="showAddModal" />
	<ServerModal v-model:visible="showEditModal" :server="selectedServer" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { queryServers } from '@app/queries/queryServers';
import { useQuery } from '@tanstack/vue-query';
import ServerModal from '@app/components/ServerModal.vue';
import type { ServerPeer } from '@server/db/schema';
import BaseButton from '@app/components/BaseButton.vue';
import BaseCard from '@app/components/BaseCard.vue';
import DataView from '@app/components/DataView.vue';

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
