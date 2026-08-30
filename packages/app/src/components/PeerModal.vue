<template>
	<BaseModal v-model:visible="visible" :header="isEditMode ? 'edit peer' : 'add peer'">
		<form @submit.prevent="handleSubmit" class="flex flex-col gap-5">
			<div class="field">
				<label for="friendlyName" class="mb-1.5 text-sm text-muted block"><span class="text-accent-dim">&gt;</span> friendly name</label>
				<BaseInput id="friendlyName" v-model="form.friendlyName" class="w-full" placeholder="e.g. sales-ipad-07" />
				<small class="text-muted text-xs">a memorable name for this client device</small>
			</div>
			<div class="field">
				<label for="wgAddress" class="mb-1.5 text-sm text-muted block"><span class="text-accent-dim">&gt;</span> wireguard address</label>
				<BaseInput id="wgAddress" v-model="form.wgAddress" class="w-full" placeholder="leave empty to auto-assign" />
				<small class="text-muted text-xs">static ip address (optional). next free address is used if left blank</small>
				<span v-if="errors.wgAddress" class="text-down text-xs block mt-1">{{ errors.wgAddress }}</span>
			</div>
			<div class="field">
				<label for="groupId" class="mb-1.5 text-sm text-muted block"><span class="text-accent-dim">&gt;</span> group</label>
				<select
					id="groupId"
					v-model="form.groupId"
					class="block w-full rounded-sm border border-border bg-bg text-text px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:border-accent"
				>
					<option :value="null">none - unrestricted</option>
					<option v-for="group in groups" :key="group.id" :value="group.id">{{ group.friendlyName ?? group.name }}</option>
				</select>
				<small class="text-muted text-xs">restricts reachability to what the group's policy allows. leave unset for unrestricted access</small>
			</div>
			<div class="flex justify-end gap-2 mt-2">
				<BaseButton @click="visible = false" variant="ghost" type="button">cancel</BaseButton>
				<BaseButton type="submit" variant="primary">
					{{ isEditMode ? 'save changes' : 'add peer' }}
				</BaseButton>
			</div>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useToast } from '@app/composables/useToast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Peer, ServerPeer } from '@server/db/schema';
import { eden } from '@app/queries/edenClient';
import { queryServerGroups } from '@app/queries/queryGroups';
import BaseButton from './BaseButton.vue';
import BaseInput from './BaseInput.vue';
import BaseModal from './BaseModal.vue';

const toast = useToast();

const props = defineProps<{
	peer?: Peer;
	server: ServerPeer;
}>();

const isEditMode = ref(props.peer ? true : false);

const visible = defineModel<boolean>('visible', { required: true });
const queryClient = useQueryClient();

const { data: groups } = useQuery(queryServerGroups(props.server.id));

const form = reactive<{
	friendlyName?: string;
	wgAddress?: string;
	groupId?: string | null;
}>({
	friendlyName: '',
	wgAddress: '',
	groupId: null,
});

const errors = reactive({
	wgAddress: '',
});

const validate = () => {
	let isValid = true;
	errors.wgAddress = '';

	if (form.wgAddress) {
		// Simple IPv4 validation
		const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
		// Simple IPv6 validation (basic)
		const ipv6Regex = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
		
		if (!ipv4Regex.test(form.wgAddress) && !ipv6Regex.test(form.wgAddress)) {
			errors.wgAddress = 'Invalid IP address format.';
			isValid = false;
		}
	}

	return isValid;
};

watch(
	() => props.peer,
	(peer) => {
		if (peer) {
			form.friendlyName = peer.friendlyName ?? '';
			form.wgAddress = peer.wgAddress ?? '';
			form.groupId = peer.groupId ?? null;
			isEditMode.value = true;
		} else {
			isEditMode.value = false;
			form.friendlyName = '';
			form.wgAddress = '';
			form.groupId = null;
		}
		errors.wgAddress = '';
	},
	{ immediate: true }
);

const createPeer = useMutation({
	mutationFn: async (data: typeof form) => {
		const res = await eden.api.v1.wg.servers({ id: props.server.id }).peers.post(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['serverPeers', props.server.id] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to create peer',
			life: 5000,
		});
	},
});

const updatePeer = useMutation({
	mutationFn: async (data: typeof form) => {
		if (!props.peer) return;
		const res = await eden.api.v1.wg.servers({ id: props.server.id }).peers({ peerId: props.peer.id }).patch(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['serverPeers', props.server.id] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to update peer',
			life: 5000,
		});
	},
});

const handleSubmit = () => {
	if (!validate()) {
		return;
	}
	const data = { ...form };
	if (data.wgAddress === '') {
		data.wgAddress = undefined;
	}
	if (data.friendlyName === '') {
		data.friendlyName = undefined;
	}
	if (isEditMode.value) {
		updatePeer.mutate(data);
	} else {
		createPeer.mutate(data);
	}
};
</script>
