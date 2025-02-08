<template>
	<div>
		<div class="flex gap-5 items-center mb-4">
			<h1 class="text-2xl font-bold">Servers</h1>
			<Button label="Add Server" @click="showAddModal = true">
				<Icon><AddIcon /></Icon>
			</Button>
		</div>
		<div class="grid grid-cols-6">
			<div v-for="server in servers">
				<Card>
					<template #title>{{ server.friendlyName ?? server.id }}</template>
					<template #content>
						<table class="table-auto table-definition">
							<tbody>
								<tr>
									<td>Id</td>
									<td>{{ server.id }}</td>
								</tr>
								<tr>
									<td>Endpoint</td>
									<td>{{ server.wgEndpoint }}</td>
								</tr>
							</tbody>
						</table>
					</template>
					<template #footer>
						<div class="flex gap-4 mt-1">
							<Button as="router-link" :to="'/servers/' + server.id" label="View" class="w-full" />
							<Button @click="editServer(server)">
								<Icon><EditIcon /></Icon>
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

const { data: servers } = useQuery(queryServers());
const showAddModal = ref(false);
const showEditModal = ref(false);
const selectedServer = ref<ServerPeer>();

const editServer = (server: ServerPeer) => {
	selectedServer.value = server;
	showEditModal.value = true;
};
</script>

<style>
.table-definition td {
	padding: 0.5rem;
}
</style>
