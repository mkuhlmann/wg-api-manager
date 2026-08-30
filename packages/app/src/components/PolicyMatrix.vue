<template>
	<div v-if="groups.length === 0" class="text-center py-12 text-muted text-sm">no groups yet - add one to start restricting peers</div>

	<div v-else class="flex flex-col gap-4">
		<div class="overflow-x-auto rounded-sm border border-border">
			<table class="text-left text-sm border-collapse">
				<thead class="bg-surface text-xs uppercase tracking-wide text-muted">
					<tr>
						<th class="px-4 py-2.5 whitespace-nowrap">src &darr; / dst &rarr;</th>
						<th v-for="col in groups" :key="col.id" class="px-4 py-2.5 text-center whitespace-nowrap">{{ col.friendlyName ?? col.name }}</th>
						<th class="px-4 py-2.5 text-center whitespace-nowrap">server</th>
						<th class="px-4 py-2.5 text-center whitespace-nowrap">internet</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border bg-surface/40">
					<tr v-for="row in groups" :key="row.id" class="hover:bg-surface2 transition-colors">
						<td class="px-4 py-3 font-medium text-text whitespace-nowrap">
							{{ row.friendlyName ?? row.name }}
							<span class="text-muted text-xs block">{{ row.memberCount }} peer{{ row.memberCount === 1 ? '' : 's' }}</span>
						</td>
						<td v-for="col in groups" :key="col.id" class="px-4 py-3 text-center">
							<button
								type="button"
								class="text-accent-dim hover:text-accent transition-colors disabled:opacity-40"
								:disabled="replaceRules.isPending.value"
								:title="row.id === col.id ? 'allow members to reach each other' : `allow ${row.friendlyName ?? row.name} -> ${col.friendlyName ?? col.name}`"
								@click="toggleCell(row, col.id)"
							>
								{{ hasCell(row, col.id) ? '[x]' : '[ ]' }}
							</button>
						</td>
						<td class="px-4 py-3 text-center">
							<button
								type="button"
								class="text-accent-dim hover:text-accent transition-colors disabled:opacity-40"
								:disabled="updateGroupFlags.isPending.value"
								@click="updateGroupFlags.mutate({ groupId: row.id, allowServer: !row.allowServer })"
							>
								{{ row.allowServer ? '[x]' : '[ ]' }}
							</button>
						</td>
						<td class="px-4 py-3 text-center">
							<button
								type="button"
								class="text-accent-dim hover:text-accent transition-colors disabled:opacity-40"
								:disabled="updateGroupFlags.isPending.value"
								@click="updateGroupFlags.mutate({ groupId: row.id, allowInternet: !row.allowInternet })"
							>
								{{ row.allowInternet ? '[x]' : '[ ]' }}
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="text-xs text-muted">
			the diagonal cell controls whether members of a group can reach each other - unticked, peers in the same group cannot see one another. "server" grants
			reaching the gateway's own tunnel address (dns, management api). "internet" also requires <span class="text-text">enable nat</span> on the server.
		</div>

		<!-- dstCidr targets, per group -->
		<div class="flex flex-col gap-3">
			<h3 class="text-sm font-bold text-text"><span class="text-accent-dim">///</span> subnet targets</h3>
			<div v-for="row in groups" :key="row.id" class="flex items-center gap-3 flex-wrap">
				<span class="text-sm text-muted w-32 shrink-0 whitespace-nowrap">{{ row.friendlyName ?? row.name }}</span>
				<BaseInput
					v-model="cidrDrafts[row.id]"
					class="flex-1 min-w-64"
					placeholder="e.g. 192.168.50.0/24, 10.99.0.0/16"
					@blur="saveCidrs(row)"
					@keydown.enter="saveCidrs(row)"
				/>
			</div>
			<small class="text-muted text-xs">comma-separated cidrs this group may additionally reach, outside the vpn subnet</small>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { eden } from '@app/queries/edenClient';
import { useToast } from '@app/composables/useToast';
import BaseInput from './BaseInput.vue';

type GroupWithRules = {
	id: string;
	name: string;
	friendlyName: string | null;
	allowServer: boolean;
	allowInternet: boolean;
	memberCount: number;
	rules: { dstGroupId: string | null; dstCidr: string | null }[];
};

const props = defineProps<{
	serverId: string;
	groups: GroupWithRules[];
}>();

const toast = useToast();
const queryClient = useQueryClient();

// local text-input drafts for each group's dstCidr list, seeded from server state
// and left untouched once a user starts editing (only re-seeded for groups we
// haven't seen a draft for yet).
const cidrDrafts = reactive<Record<string, string>>({});

watch(
	() => props.groups,
	(groups) => {
		for (const g of groups) {
			if (cidrDrafts[g.id] === undefined) {
				cidrDrafts[g.id] = g.rules
					.filter((r) => r.dstCidr)
					.map((r) => r.dstCidr)
					.join(', ');
			}
		}
	},
	{ immediate: true, deep: true }
);

const invalidate = () => queryClient.invalidateQueries({ queryKey: ['serverGroups', props.serverId] });

const onMutationError = (summary: string) => (error: Error) => {
	toast.add({ severity: 'error', detail: error.message, summary, life: 5000 });
};

const replaceRules = useMutation({
	mutationFn: async ({ groupId, dstGroupIds, dstCidrs }: { groupId: string; dstGroupIds: string[]; dstCidrs: string[] }) => {
		const res = await eden.api.v1.wg.servers({ id: props.serverId }).groups({ groupId }).rules.put({ dstGroupIds, dstCidrs });
		return res.data;
	},
	onSuccess: invalidate,
	onError: onMutationError('Failed to update rules'),
});

const updateGroupFlags = useMutation({
	mutationFn: async ({ groupId, ...body }: { groupId: string; allowServer?: boolean; allowInternet?: boolean }) => {
		const res = await eden.api.v1.wg.servers({ id: props.serverId }).groups({ groupId }).patch(body);
		return res.data;
	},
	onSuccess: invalidate,
	onError: onMutationError('Failed to update group'),
});

const hasCell = (row: GroupWithRules, colGroupId: string) => row.rules.some((r) => r.dstGroupId === colGroupId);

const parseCidrs = (groupId: string) =>
	(cidrDrafts[groupId] ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

const toggleCell = (row: GroupWithRules, colGroupId: string) => {
	const current = row.rules.filter((r) => r.dstGroupId).map((r) => r.dstGroupId as string);
	const dstGroupIds = current.includes(colGroupId) ? current.filter((id) => id !== colGroupId) : [...current, colGroupId];
	replaceRules.mutate({ groupId: row.id, dstGroupIds, dstCidrs: parseCidrs(row.id) });
};

const saveCidrs = (row: GroupWithRules) => {
	const dstGroupIds = row.rules.filter((r) => r.dstGroupId).map((r) => r.dstGroupId as string);
	replaceRules.mutate({ groupId: row.id, dstGroupIds, dstCidrs: parseCidrs(row.id) });
};
</script>
