<template>
	<h1 class="text-2xl font-bold mb-4">Servers</h1>

	<div class="grid grid-cols-6">
		<div v-for="server in servers">
			<Card>
				<template #title>{{ server.friendlyName ?? server.id }}</template>
				<template #content>
					<table class="table-auto table-definition">
						<tbody>
							<tr>
								<td>Id</td>
								<td>
									{{ server.id }}
								</td>
							</tr>
							<tr>
								<td>Endpoint</td>
								<td>
									{{ server.wgEndpoint }}
								</td>
							</tr>
						</tbody>
					</table>
				</template>
				<template #footer>
					<div class="flex gap-4 mt-1">
						<Button as="router-link" :to="'/servers/' + server.id" label="View" class="w-full" />
					</div>
				</template>
			</Card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { queryServers } from '@app/queries/queryServers';
import { useQuery } from '@tanstack/vue-query';
import { Button, Card } from 'primevue';

const { data: servers } = useQuery(queryServers());
</script>

<style>
.table-definition td {
	padding: 0.5rem;
}
</style>
