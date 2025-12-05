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

		<div class="flex flex-col gap-8">
			<!-- Server Details -->
			<div class="flex flex-col gap-4">
				<h1 class="text-3xl font-light text-white drop-shadow">Server</h1>
				<div class="w-full max-w-2xl" v-if="server">
					<PeerModal v-model:visible="showAddPeerModal" :server="server" />
					<PeerModal v-model:visible="showEditPeerModal" :peer="selectedPeer" :server="server" />
					
					<BaseCard :title="server.friendlyName ?? server.id">
						<template #header>
							<div class="flex items-center gap-2 text-sky-500">
								<Icon class="w-5 h-5"><AddIcon /></Icon>
								<span class="text-lg font-bold">{{ server.friendlyName ?? server.id }}</span>
							</div>
						</template>
						
						<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm text-gray-300">
							<span class="font-semibold text-gray-500">Id</span>
							<span class="truncate font-mono">{{ server.id }}</span>
							
							<span class="font-semibold text-gray-500">Endpoint</span>
							<span class="truncate font-mono">{{ server.wgEndpoint }}</span>
							
							<span class="font-semibold text-gray-500">Listen Port</span>
							<span class="truncate font-mono">{{ server.wgListenPort }}</span>
							
							<span class="font-semibold text-gray-500">CIDR Range</span>
							<span class="truncate font-mono">{{ server.cidrRange }}</span>
						</div>
					</BaseCard>
				</div>
			</div>

			<!-- Peers List -->
			<div class="flex flex-col gap-4">
				<div class="flex justify-between items-center">
					<h1 class="text-2xl font-light text-white">Peers</h1>
					<BaseButton @click="showAddPeerModal = true">
						<template #icon-left>
							<Icon class="w-5 h-5"><AddIcon /></Icon>
						</template>
						Add Peer
					</BaseButton>
				</div>

				<DataView
					:items="peers || []"
					:filter-fields="['id', 'friendlyName', 'wgAddress']"
					default-layout="grid"
				>
					<template #grid-item="{ item: peer }">
						<BaseCard :title="peer.friendlyName ?? peer.id" class="h-full flex flex-col">
							<template #header>
								<div class="flex items-center gap-2 text-blue-300">
									<span class="text-lg font-bold truncate">{{ peer.friendlyName ?? peer.id }}</span>
								</div>
							</template>
							
							<div class="flex-1 flex flex-col gap-4">
								<div class="flex items-center gap-2 text-sm">
									<span v-if="!peer.peerInfo" class="text-gray-400 flex items-center gap-1">
										<span class="text-gray-600">⬤</span> Unknown
									</span>
									<span v-else-if="peer.peerInfo.connected" class="text-green-400 flex items-center gap-1">
										<span>⬤</span> Connected
									</span>
									<span v-else class="text-red-400 flex items-center gap-1">
										<span>⬤</span> Disconnected
									</span>
								</div>

								<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-gray-300">
									<span class="font-semibold text-gray-500">Id</span>
									<span class="truncate font-mono">{{ peer.id }}</span>
									
									<span class="font-semibold text-gray-500">Address</span>
									<span class="truncate font-mono">{{ peer.wgAddress }}</span>
									
									<template v-if="peer.peerInfo">
										<span class="font-semibold text-gray-500">Last Handshake</span>
										<span class="truncate">{{ peer.peerInfo.wgLatestHandshake == 0 ? '-' : new Date(peer.peerInfo.wgLatestHandshake * 1000).toLocaleString() }}</span>
										
										<span class="font-semibold text-gray-500">Received</span>
										<span class="truncate">{{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</span>
										
										<span class="font-semibold text-gray-500">Transmitted</span>
										<span class="truncate">{{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</span>
									</template>
								</div>
							</div>

							<template #footer>
								<div class="grid grid-cols-4 gap-2">
									<BaseButton @click="showQrCode(peer.id)" variant="secondary" class="px-0! flex justify-center" title="QR Code">
										<Icon class="w-5 h-5"><QrCodeIcon /></Icon>
									</BaseButton>
									<BaseButton @click="showConfig(peer.id)" variant="secondary" class="px-0! flex justify-center" title="Config">
										<Icon class="w-5 h-5"><CodeIcon /></Icon>
									</BaseButton>
									<BaseButton @click="editPeer(peer)" variant="secondary" class="px-0! flex justify-center text-yellow-500! hover:text-yellow-400!" title="Edit">
										<Icon class="w-5 h-5"><EditIcon /></Icon>
									</BaseButton>
									<BaseButton @click="deletePeer(peer.id)" variant="secondary" class="px-0! flex justify-center text-red-500! hover:text-red-400!" title="Delete">
										<Icon class="w-5 h-5"><DeleteIcon /></Icon>
									</BaseButton>
								</div>
							</template>
						</BaseCard>
					</template>

					<template #table-header>
						<th class="px-6 py-3">Status</th>
						<th class="px-6 py-3">Name/ID</th>
						<th class="px-6 py-3">Address</th>
						<th class="px-6 py-3">Transfer</th>
						<th class="px-6 py-3 text-right">Actions</th>
					</template>

					<template #table-row="{ item: peer }">
						<td class="px-6 py-4">
							<span v-if="!peer.peerInfo" class="text-gray-400" title="Unknown">⬤</span>
							<span v-else-if="peer.peerInfo.connected" class="text-green-400" title="Connected">⬤</span>
							<span v-else class="text-red-400" title="Disconnected">⬤</span>
						</td>
						<td class="px-6 py-4 font-medium text-white">
							{{ peer.friendlyName ?? peer.id }}
						</td>
						<td class="px-6 py-4 font-mono text-gray-400">
							{{ peer.wgAddress }}
						</td>
						<td class="px-6 py-4 text-gray-400 text-xs">
							<div v-if="peer.peerInfo">
								<div>↓ {{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</div>
								<div>↑ {{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</div>
							</div>
							<div v-else>-</div>
						</td>
						<td class="px-6 py-4 text-right">
							<div class="flex justify-end gap-2">
								<BaseButton @click="showQrCode(peer.id)" variant="ghost" size="sm" title="QR Code">
									<Icon class="w-4 h-4"><QrCodeIcon /></Icon>
								</BaseButton>
								<BaseButton @click="showConfig(peer.id)" variant="ghost" size="sm" title="Config">
									<Icon class="w-4 h-4"><CodeIcon /></Icon>
								</BaseButton>
								<BaseButton @click="editPeer(peer)" variant="ghost" size="sm" class="text-yellow-500!" title="Edit">
									<Icon class="w-4 h-4"><EditIcon /></Icon>
								</BaseButton>
								<BaseButton @click="deletePeer(peer.id)" variant="ghost" size="sm" class="text-red-500!" title="Delete">
									<Icon class="w-4 h-4"><DeleteIcon /></Icon>
								</BaseButton>
							</div>
						</td>
					</template>
				</DataView>
			</div>
		</div>

		<BaseModal v-model:visible="modalQrCode" header="QR Code">
			<div class="bg-white p-2 rounded-lg flex justify-center">
				<QrcodeVue v-if="modalQrCode" :size="300" :value="wgConfig" />
			</div>
		</BaseModal>

		<BaseModal v-model:visible="modalConfig" header="Configuration">
			<div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
				<pre class="font-mono text-sm text-gray-300 overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{{ wgConfig }}</pre>
			</div>
			<template #footer>
				<div class="flex items-center gap-4 w-full justify-end">
					<span class="opacity-0 transition-opacity text-green-400 font-medium" :class="{ 'opacity-100': showCopiedToClipboard }">✅ Copied</span>
					<BaseButton @click="copyConfig" variant="primary">
						<template #icon-left>
							<Icon class="w-5 h-5"><CopyIcon /></Icon>
						</template>
						Copy to clipboard
					</BaseButton>
				</div>
			</template>
		</BaseModal>
	</div>
</template>

<script setup lang="ts">
import { queryServer, queryServerPeers } from '@app/queries/queryServers';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRoute } from 'vue-router';
import { ref } from 'vue';
import { api } from '@app/queries/edenClient';
import QrcodeVue from 'qrcode.vue';
import PeerModal from '@app/components/PeerModal.vue';
import type { Peer } from '@server/db/schema';
import BaseButton from '@app/components/BaseButton.vue';
import BaseCard from '@app/components/BaseCard.vue';
import DataView from '@app/components/DataView.vue';
import BaseModal from '@app/components/BaseModal.vue';

import QrCodeIcon from '@vicons/carbon/QrCode';
import CodeIcon from '@vicons/carbon/Code';
import EditIcon from '@vicons/carbon/Edit';
import AddIcon from '@vicons/carbon/AddAlt';
import DeleteIcon from '@vicons/carbon/Delete';
import CopyIcon from '@vicons/carbon/Copy';
import { Icon } from '@vicons/utils';

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
	if (!confirm('Are you sure you want to delete this peer?')) return;
	
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
