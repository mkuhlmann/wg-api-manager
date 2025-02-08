<template>
	<Dialog v-model:visible="visible" :modal="true" :header="isEditMode ? 'Edit Server' : 'Add Server'" :style="{ width: '50vw' }">
		<form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
			<div class="field">
				<label for="friendlyName" class="mb-1">Friendly Name</label>
				<InputText id="friendlyName" v-model="form.friendlyName" class="w-full" />
				<small class="text-gray-500">A friendly name for the server.</small>
			</div>
			<div class="field">
				<label for="interfaceName" class="mb-1">Interface Name</label>
				<InputText id="interfaceName" v-model="form.interfaceName" class="w-full" required />
				<small class="text-gray-500">The name of the network interface, regex: /^[a-zA-Z0-9_=+.-]{1,15}$/.</small>
			</div>
			<div class="field">
				<label for="wgAddress" class="mb-1">WireGuard Address</label>
				<InputText id="wgAddress" v-model="form.wgAddress" class="w-full" required />
				<small class="text-gray-500">The ip of the WireGuard server, e.g. 10.8.0.1</small>
			</div>
			<div class="field">
				<label for="wgEndpoint" class="mb-1">WireGuard Endpoint</label>
				<InputText id="wgEndpoint" v-model="form.wgEndpoint" class="w-full" required />
				<small class="text-gray-500">The endpoint address for the WireGuard server.</small>
			</div>
			<div class="field">
				<label for="wgListenPort" class="mb-1">Listen Port</label>
				<InputNumber id="wgListenPort" v-model="form.wgListenPort" class="w-full" required />
				<small class="text-gray-500">The port on which the WireGuard server will listen.</small>
			</div>
			<div class="field">
				<label for="cidrRange" class="mb-1">CIDR Range</label>
				<InputText id="cidrRange" v-model="form.cidrRange" class="w-full" required />
				<small class="text-gray-500">The CIDR range for the server's network, regex: /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[1-2][0-9]|3[0-2])$/.</small>
				<span v-if="!isCidrValid" class="text-red-500">Invalid CIDR range, e.g. 10.8.0.0/24</span>
			</div>
			<div class="field">
				<label for="reservedIps" class="mb-1">Reserved IPs</label>
				<InputNumber id="reservedIps" v-model="form.reservedIps" class="w-full" required />
				<small class="text-gray-500">The number of IPs to skip until allocating clients.</small>
			</div>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="visible = false" outlined />
				<Button :label="isEditMode ? 'Save Changes' : 'Add Server'" type="submit" />
			</div>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { Dialog, Button, InputText, InputNumber, useToast } from 'primevue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ServerPeer } from '@server/db/schema';
import { eden } from '@app/queries/edenClient';

const props = defineProps<{
	server?: ServerPeer;
}>();

const toast = useToast();

const isEditMode = ref(props.server ? true : false);

const visible = defineModel<boolean>('visible');
const queryClient = useQueryClient();

const form = reactive({
	friendlyName: '',
	interfaceName: '',
	wgAddress: '',
	wgEndpoint: '',
	wgListenPort: 51820,
	cidrRange: '10.0.0.0/24',
	reservedIps: 50,
});

const isCidrValid = computed(() => {
	const cidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
	return cidrRegex.test(form.cidrRange);
});

watch(
	() => props.server,
	(server) => {
		if (server) {
			form.friendlyName = server.friendlyName ?? '';
			form.interfaceName = server.interfaceName ?? '';
			form.wgAddress = server.wgAddress ?? '';
			form.wgEndpoint = server.wgEndpoint;
			form.wgListenPort = server.wgListenPort;
			form.cidrRange = server.cidrRange ?? '10.0.0.0/24';
			form.reservedIps = server.reservedIps ?? 50;
			isEditMode.value = true;
		} else {
			isEditMode.value = false;
		}
	},
	{ immediate: true }
);

const createServer = useMutation({
	mutationFn: async (data: typeof form) => {
		const res = await eden.api.v1.wg.servers.post(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['servers'] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to create server',
			life: 5000,
		});
	},
});

const updateServer = useMutation({
	mutationFn: async (data: typeof form) => {
		if (!props.server) return;
		const res = await eden.api.v1.wg.servers({ id: props.server?.id }).patch(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['servers'] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to update server',
			life: 5000,
		});
	},
});

const handleSubmit = () => {
	if (!isCidrValid.value) {
		alert('Please enter a valid CIDR range.');
		return;
	}
	if (isEditMode.value) {
		updateServer.mutate(form);
	} else {
		createServer.mutate(form);
	}
};
</script>
