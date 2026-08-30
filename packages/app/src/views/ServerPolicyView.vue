<template>
	<div class="flex flex-col gap-8">
		<div class="text-xs text-muted" v-if="isLoading">loading server... <span class="caret"></span></div>

		<div class="flex flex-col gap-4" v-if="server">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<h1 class="text-lg font-bold text-text">
					<span class="text-accent-dim">///</span> {{ server.friendlyName ?? server.id }} <span class="text-muted">/ policy</span>
				</h1>
				<BaseButton :as="'router-link'" :to="{ name: 'servers-detail', params: { id: server.id } }" variant="ghost">&laquo; back to server</BaseButton>
			</div>

			<GroupModal v-model:visible="showAddGroupModal" :server="server" />
			<GroupModal v-model:visible="showEditGroupModal" :group="selectedGroup" :server="server" />

			<div class="flex flex-col gap-4">
				<div class="flex justify-between items-center flex-wrap gap-3">
					<h2 class="text-base font-bold text-text"><span class="text-accent-dim">///</span> groups</h2>
					<BaseButton @click="showAddGroupModal = true">add group</BaseButton>
				</div>

				<div v-if="!groups || groups.length === 0" class="text-center py-8 text-muted text-sm">no groups yet - ungrouped peers stay fully unrestricted</div>

				<div v-else class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
					<BaseCard v-for="group in groups" :key="group.id" :title="group.friendlyName ?? group.name" class="h-full flex flex-col">
						<div class="flex-1 flex flex-col gap-3">
							<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-muted">
								<span class="whitespace-nowrap">name</span>
								<span class="text-text text-right break-all">{{ group.name }}</span>

								<span class="whitespace-nowrap">peers</span>
								<span class="text-text text-right">{{ group.memberCount }}</span>

								<span class="whitespace-nowrap">server</span>
								<span class="text-right" :class="group.allowServer ? 'text-up' : 'text-muted'">{{ group.allowServer ? 'allowed' : 'blocked' }}</span>

								<span class="whitespace-nowrap">internet</span>
								<span class="text-right" :class="group.allowInternet ? 'text-up' : 'text-muted'">{{ group.allowInternet ? 'allowed' : 'blocked' }}</span>
							</div>
						</div>

						<template #footer>
							<div class="grid grid-cols-2 gap-2">
								<BaseButton @click="editGroup(group)" variant="secondary" size="sm">edit</BaseButton>
								<BaseButton @click="deleteGroup(group.id)" variant="danger" size="sm">del</BaseButton>
							</div>
						</template>
					</BaseCard>
				</div>
			</div>

			<div class="rule-line"></div>

			<div class="flex flex-col gap-4">
				<h2 class="text-base font-bold text-text"><span class="text-accent-dim">///</span> reachability matrix</h2>
				<PolicyMatrix :server-id="server.id" :groups="groups ?? []" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { queryServer } from '@app/queries/queryServers';
import { queryServerGroups } from '@app/queries/queryGroups';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRoute } from 'vue-router';
import { ref } from 'vue';
import { eden } from '@app/queries/edenClient';
import type { PeerGroup } from '@server/db/schema';
import BaseButton from '@app/components/BaseButton.vue';
import BaseCard from '@app/components/BaseCard.vue';
import GroupModal from '@app/components/GroupModal.vue';
import PolicyMatrix from '@app/components/PolicyMatrix.vue';

const route = useRoute();
const queryClient = useQueryClient();

const { data: server, isLoading } = useQuery(queryServer(route.params.id as string));
const { data: groups } = useQuery(queryServerGroups(route.params.id as string));

const showAddGroupModal = ref(false);
const showEditGroupModal = ref(false);
const selectedGroup = ref<PeerGroup>();

const editGroup = (group: PeerGroup) => {
	selectedGroup.value = group;
	showEditGroupModal.value = true;
};

const deleteGroup = async (groupId: string) => {
	if (!confirm('Delete this group? Member peers become unrestricted, they are not deleted.')) return;

	await eden.api.v1.wg
		.servers({ id: route.params.id as string })
		.groups({ groupId })
		.delete();
	await queryClient.invalidateQueries({ queryKey: ['serverGroups', route.params.id as string] });
};
</script>
