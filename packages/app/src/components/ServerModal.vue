<template>
	<BaseModal v-model:visible="visible" :header="isEditMode ? 'Edit Server' : 'Add Server'">
		<form @submit.prevent="handleSubmit" class="flex flex-col gap-6">
			<div class="field">
				<label for="friendlyName" class="mb-1 font-semibold text-sky-500 block">Friendly Name</label>
				<BaseInput id="friendlyName" v-model="form.friendlyName" class="w-full" placeholder="e.g. Primary VPN" />
				<small class="text-gray-400">A memorable name for this server.</small>
			</div>
			<div class="field">
				<label for="interfaceName" class="mb-1 font-semibold text-sky-500 block">Interface Name</label>
				<BaseInput id="interfaceName" v-model="form.interfaceName" class="w-full" required placeholder="e.g. wg0" />
				<small class="text-gray-400">The network interface name. Must be alphanumeric (max 15 chars).</small>
				<span v-if="errors.interfaceName" class="text-red-500 text-sm block mt-1">{{ errors.interfaceName }}</span>
			</div>
			<div class="field">
				<label for="wgAddress" class="mb-1 font-semibold text-sky-500 block">WireGuard Address</label>
				<BaseInput id="wgAddress" v-model="form.wgAddress" class="w-full" required placeholder="e.g. 10.8.0.1" />
				<small class="text-gray-400">The internal IP address for the WireGuard interface.</small>
				<span v-if="errors.wgAddress" class="text-red-500 text-sm block mt-1">{{ errors.wgAddress }}</span>
			</div>
			<div class="field">
				<label for="wgEndpoint" class="mb-1 font-semibold text-sky-500 block">WireGuard Endpoint</label>
				<BaseInput id="wgEndpoint" v-model="form.wgEndpoint" class="w-full" required placeholder="e.g. vpn.example.com:51820" />
				<small class="text-gray-400">The public IP or domain and port where this server is reachable.</small>
			</div>
			<div class="field">
				<label for="wgListenPort" class="mb-1 font-semibold text-sky-500 block">Listen Port</label>
				<BaseInput id="wgListenPort" v-model.number="form.wgListenPort" type="number" class="w-full" required placeholder="51820" />
				<small class="text-gray-400">The UDP port WireGuard will listen on (1-65535).</small>
				<span v-if="errors.wgListenPort" class="text-red-500 text-sm block mt-1">{{ errors.wgListenPort }}</span>
			</div>
			<div class="field">
				<label for="cidrRange" class="mb-1 font-semibold text-sky-500 block">CIDR Range</label>
				<BaseInput id="cidrRange" v-model="form.cidrRange" class="w-full" required placeholder="e.g. 10.8.0.0/24" />
				<small class="text-gray-400">The subnet for the VPN network. Clients get IPs from this range.</small>
				<span v-if="errors.cidrRange" class="text-red-500 text-sm block mt-1">{{ errors.cidrRange }}</span>
			</div>
			<div class="field">
				<label for="reservedIps" class="mb-1 font-semibold text-sky-500 block">Reserved IPs</label>
				<BaseInput id="reservedIps" v-model.number="form.reservedIps" type="number" class="w-full" required placeholder="50" />
				<small class="text-gray-400">Number of IPs to reserve at the start of the subnet range.</small>
			</div>
			<div class="flex justify-end gap-2 mt-4">
				<BaseButton label="Cancel" @click="visible = false" variant="ghost" type="button">Cancel</BaseButton>
				<BaseButton type="submit" variant="primary">
					{{ isEditMode ? 'Save Changes' : 'Add Server' }}
				</BaseButton>
			</div>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ServerPeer } from '@server/db/schema';
import { eden } from '@app/queries/edenClient';
import BaseButton from './BaseButton.vue';
import BaseInput from './BaseInput.vue';
import BaseModal from './BaseModal.vue';

const props = defineProps<{
	server?: ServerPeer;
}>();

const toast = useToast();

const isEditMode = ref(props.server ? true : false);

const visible = defineModel<boolean>('visible', { required: true });
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

const errors = reactive({
	interfaceName: '',
	wgAddress: '',
	wgListenPort: '',
	cidrRange: '',
});

const validate = () => {
	let isValid = true;
	errors.interfaceName = '';
	errors.wgAddress = '';
	errors.wgListenPort = '';
	errors.cidrRange = '';

	// Interface Name validation
	const interfaceRegex = /^[a-zA-Z0-9_=+.-]{1,15}$/;
	if (!interfaceRegex.test(form.interfaceName)) {
		errors.interfaceName = 'Invalid interface name. Must be 1-15 alphanumeric characters (allows _, =, +, ., -).';
		isValid = false;
	}

	// CIDR validation helper
	const cidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;

	// WireGuard Address validation
	// Allow simple IP or CIDR
	const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
	if (!ipv4Regex.test(form.wgAddress)) {
		errors.wgAddress = 'Invalid WireGuard Address. Must be a valid IP address (e.g., 10.8.0.1).';
		isValid = false;
	}

	// Listen Port validation
	if (form.wgListenPort < 1 || form.wgListenPort > 65535) {
		errors.wgListenPort = 'Port must be between 1 and 65535.';
		isValid = false;
	}

	// CIDR Range validation
	if (!cidrRegex.test(form.cidrRange)) {
		errors.cidrRange = 'Invalid CIDR range (e.g., 10.8.0.0/24).';
		isValid = false;
	}

	return isValid;
};

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
			// Reset form defaults
			form.friendlyName = '';
			form.interfaceName = '';
			form.wgAddress = '';
			form.wgEndpoint = '';
			form.wgListenPort = 51820;
			form.cidrRange = '10.0.0.0/24';
			form.reservedIps = 50;
		}
		// Clear errors when opening/changing server
		errors.interfaceName = '';
		errors.wgAddress = '';
		errors.wgListenPort = '';
		errors.cidrRange = '';
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
	if (!validate()) {
		return;
	}
	if (isEditMode.value) {
		updateServer.mutate(form);
	} else {
		createServer.mutate(form);
	}
};
</script>
