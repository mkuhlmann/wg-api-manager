<template>
	<div class="px-8 py-6 relative">
		<div v-if="isLoading" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
			<div class="flex flex-col items-center gap-4">
				<svg class="animate-spin h-12 w-12 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
				</svg>
				<span class="text-white text-lg font-semibold">Loading server...</span>
			</div>
		</div>
		<div class="mb-8">
			<h1 class="text-3xl font-light text-white drop-shadow mb-4">Server</h1>
			<div class="inline-block w-lg" v-if="server">
				<PeerModal v-model:visible="showAddPeerModal" :server="server" />
				<PeerModal v-model:visible="showEditPeerModal" :peer="selectedPeer" :server="server" />
				<Card class="!rounded-none shadow-xl !bg-gray-800">
					<template #title>
						<span class="text-lg font-bold text-sky-500 flex items-center gap-2">
							<Icon class="w-5 h-5 text-sky-500"><AddIcon /></Icon>
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
								<tr>
									<td class="font-semibold pr-2">Listen Port</td>
									<td class="truncate">{{ server.wgListenPort }}</td>
								</tr>
								<tr>
									<td class="font-semibold pr-2">CIDR Range</td>
									<td class="truncate">{{ server.cidrRange }}</td>
								</tr>
							</tbody>
						</table>
					</template>
				</Card>
			</div>
		</div>
		<div class="flex gap-5 items-center my-4">
			<h1 class="text-2xl font-light text-white">Peers</h1>
			<Button label="Add Peer" @click="showAddPeerModal = true" class="!bg-sky-500 text-white !border-none">
				<Icon class="w-5 h-5"><AddIcon /></Icon>
			</Button>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
			<div v-for="peer in peers" :key="peer.id">
				<Card class="!rounded-none shadow-xl !bg-gray-800 hover:scale-105 transition-transform duration-200">
					<template #title>
						<span class="text-lg font-bold text-blue-300 flex items-center gap-2">
							{{ peer.friendlyName ?? peer.id }}
						</span>
					</template>
					<template #content>
						<div class="mb-2">
							<span v-if="!peer.peerInfo" class="text-gray-400 flex items-center gap-1"><span class="text-gray-600">⬤</span> Unknown</span>
							<span v-else-if="peer.peerInfo.connected" class="text-green-400 flex items-center gap-1"><span>⬤</span> Connected</span>
							<span v-else class="text-red-400 flex items-center gap-1"><span>⬤</span> Disconnected</span>
						</div>
						<table class="w-full text-sm text-gray-300">
							<tbody>
								<tr>
									<td class="font-semibold pr-2">Id</td>
									<td class="truncate">{{ peer.id }}</td>
								</tr>
								<tr>
									<td class="font-semibold pr-2">Address</td>
									<td class="truncate">{{ peer.wgAddress }}</td>
								</tr>
								<tr v-if="peer.peerInfo">
									<td class="font-semibold pr-2">Last Handshake</td>
									<td class="truncate">{{ peer.peerInfo.wgLatestHandshake == 0 ? '-' : new Date(peer.peerInfo.wgLatestHandshake * 1000).toLocaleString() }}</td>
								</tr>
								<tr v-if="peer.peerInfo">
									<td class="font-semibold pr-2">Received</td>
									<td class="truncate">{{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</td>
								</tr>
								<tr v-if="peer.peerInfo">
									<td class="font-semibold pr-2">Transmitted</td>
									<td class="truncate">{{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</td>
								</tr>
							</tbody>
						</table>
					</template>
					<template #footer>
						<div class="flex gap-4 mt-1">
							<Button @click="showQrCode(peer.id)" class="!bg-gray-700 hover:!bg-gray-600 text-blue-300 rounded-lg shadow flex items-center justify-center">
								<Icon class="w-5 h-5"><QrCodeIcon /></Icon>
							</Button>
							<Button @click="showConfig(peer.id)" class="!bg-gray-700 hover:!bg-gray-600 text-blue-300 rounded-lg shadow flex items-center justify-center">
								<Icon class="w-5 h-5"><CodeIcon /></Icon>
							</Button>
							<Button @click="editPeer(peer)" class="!bg-yellow-600 hover:!bg-yellow-700 text-white rounded-lg shadow flex items-center justify-center">
								<Icon class="w-5 h-5"><EditIcon /></Icon>
							</Button>
							<Button @click="deletePeer(peer.id)" class="!bg-red-600 hover:!bg-red-700 text-white rounded-lg shadow flex items-center justify-center">
								<Icon class="w-5 h-5"><DeleteIcon /></Icon>
							</Button>
						</div>
					</template>
				</Card>
			</div>
		</div>
		<Dialog header="QR Code" modal v-model:visible="modalQrCode">
			<div class="bg-white p-2">
				<QrcodeVue v-if="modalQrCode" :size="500" :value="wgConfig" />
			</div>
		</Dialog>
		<Dialog header="Configuration" modal v-model:visible="modalConfig">
			<div class="bg-white dark:bg-neutral-800 p-2">
				<pre>{{ wgConfig }}</pre>
			</div>
			<div class="mt-4">
				<Button @click="copyConfig">Copy to clipboard</Button>
				<span class="opacity-0 ml-5 transition-opacity" v-bind:class="{ 'opacity-100': showCopiedToClipboard }">✅ Copied.</span>
			</div>
		</Dialog>
	</div>
</template>

<script setup lang="ts">
import { queryServer, queryServerPeers, queryServers } from '@app/queries/queryServers';
import { useQueries, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Button, Card, Dialog } from 'primevue';
import { useRoute, useRouter } from 'vue-router';

import QrCodeIcon from '@vicons/carbon/QrCode';
import CodeIcon from '@vicons/carbon/Code';
import EditIcon from '@vicons/carbon/Edit';
import AddIcon from '@vicons/carbon/AddAlt';
import DeleteIcon from '@vicons/carbon/Delete';
import { Icon } from '@vicons/utils';
import { ref } from 'vue';
import { api } from '@app/queries/edenClient';
import QrcodeVue from 'qrcode.vue';
import PeerModal from '@app/components/PeerModal.vue';
import type { Peer } from '@server/db/schema';

const route = useRoute();

const { data: server, isLoading } = useQuery(queryServer(route.params.id as string));
const { data: peers } = useQuery(queryServerPeers(route.params.id as string));

const queryClient = useQueryClient();

const modalQrCode = ref(false);
const modalConfig = ref(false);
const wgConfig = ref('');

const showQrCode = async (peerId: string) => {
	await getPeerConfig(peerId);
	modalQrCode.value = wgConfig.value !== '';
};

const getPeerConfig = async (peerId: string) => {
	const config = await api.wg.peers({ id: peerId }).config.get();
	wgConfig.value = config.data ?? '';
};

const showConfig = async (peerId: string) => {
	await getPeerConfig(peerId);
	modalConfig.value = wgConfig.value !== '';
};

const showCopiedToClipboard = ref(false);
const copyConfig = async () => {
	await navigator.clipboard.writeText(wgConfig.value);
	showCopiedToClipboard.value = true;
	setTimeout(() => {
		showCopiedToClipboard.value = false;
	}, 2000);
};

const showAddPeerModal = ref(false);
const showEditPeerModal = ref(false);
const selectedPeer = ref<Peer>();

const editPeer = (peer: Peer) => {
	selectedPeer.value = peer;
	showEditPeerModal.value = true;
};

const deletePeer = async (peerId: string) => {
	await api.wg
		.servers({ id: route.params.id as string })
		.peers({ peerId: peerId })
		.delete();
	await queryClient.invalidateQueries(queryServerPeers(route.params.id as string));
};
</script>

<style scoped>
.table-definition td {
	padding: 0.5rem;
}
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
