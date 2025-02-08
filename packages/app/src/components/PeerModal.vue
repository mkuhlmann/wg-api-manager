<template>
	<Dialog v-model:visible="visible" :modal="true" :header="isEditMode ? 'Edit Peer' : 'Add Peer'">
		<form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
			<div class="field">
				<label for="friendlyName" class="mb-1">Friendly Name</label>
				<InputText id="friendlyName" v-model="form.friendlyName" class="w-full" />
				<small class="text-gray-500">A friendly name for the peer.</small>
			</div>
			<div class="field">
				<label for="wgAddress" class="mb-1">WireGuard Address</label>
				<InputText id="wgAddress" v-model="form.wgAddress" class="w-full" />
				<small class="text-gray-500">The IP address of the WireGuard peer, <strong>optional</strong>.</small>
			</div>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="visible = false" outlined />
				<Button :label="isEditMode ? 'Save Changes' : 'Add Peer'" type="submit" />
			</div>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { Dialog, Button, InputText, useToast } from 'primevue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { Peer, ServerPeer } from '@server/db/schema';
import { eden } from '@app/queries/edenClient';

const toast = useToast();

const props = defineProps<{
	peer?: Peer;
	server: ServerPeer;
}>();

const isEditMode = ref(props.peer ? true : false);

const visible = defineModel<boolean>('visible');
const queryClient = useQueryClient();

const form = reactive<{
	friendlyName?: string;
	wgAddress?: string;
}>({
	friendlyName: '',
	wgAddress: '',
});

watch(
	() => props.peer,
	(peer) => {
		if (peer) {
			form.friendlyName = peer.friendlyName ?? '';
			form.wgAddress = peer.wgAddress ?? '';
			isEditMode.value = true;
		} else {
			isEditMode.value = false;
		}
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
