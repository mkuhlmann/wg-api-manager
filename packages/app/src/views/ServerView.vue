<template>
	<h1 class="text-2xl font-bold mb-4">Server</h1>

	<div class="grid grid-cols-6 gap-5" v-if="server">
		<PeerModal v-model:visible="showAddPeerModal" :server="server" />
		<PeerModal v-model:visible="showEditPeerModal" :peer="selectedPeer" :server="server" />

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
						<tr>
							<td>Listen Port</td>
							<td>
								{{ server.wgListenPort }}
							</td>
						</tr>
						<tr>
							<td>CIDR Range</td>
							<td>
								{{ server.cidrRange }}
							</td>
						</tr>
					</tbody>
				</table>
			</template>
		</Card>
	</div>
	<div class="flex gap-5 items-center my-4">
		<h1 class="text-2xl font-bold">Peers</h1>

		<Button label="Add Peer" @click="showAddPeerModal = true">
			<Icon><AddIcon /></Icon>
		</Button>
	</div>

	<div class="grid grid-cols-6 gap-5">
		<div v-for="peer in peers">
			<Card>
				<template #title>{{ peer.friendlyName ?? peer.id }}</template>
				<template #content>
					<div>
						<div v-if="!peer.peerInfo"><span class="text-gray-600">⬤</span> Unknown</div>
						<div v-else-if="peer.peerInfo.connected"><span class="text-green-600">⬤</span> Connected</div>
						<div v-else><span class="text-red-600">⬤</span> Disconnected</div>
					</div>
					<table class="table-auto table-definition">
						<tbody>
							<tr>
								<td>Id</td>
								<td>
									{{ peer.id }}
								</td>
							</tr>
							<tr>
								<td>Address</td>
								<td>
									{{ peer.wgAddress }}
								</td>
							</tr>
							<tr v-if="peer.peerInfo">
								<td>Last Handshake</td>
								<td>
									{{ peer.peerInfo.wgLatestHandshake == 0 ? '-' : new Date(peer.peerInfo.wgLatestHandshake * 1000).toLocaleString() }}
								</td>
							</tr>
							<tr v-if="peer.peerInfo">
								<td>Received</td>
								<td>{{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</td>
							</tr>
							<tr v-if="peer.peerInfo">
								<td>Transmitted</td>
								<td>{{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</td>
							</tr>
						</tbody>
					</table>
				</template>
				<template #footer>
					<div class="flex gap-4 mt-1">
						<Button @click="showQrCode(peer.id)">
							<Icon><QrCodeIcon /></Icon>
						</Button>
						<Button @click="showConfig(peer.id)">
							<Icon><CodeIcon /></Icon>
						</Button>
						<Button @click="editPeer(peer)" severity="warn">
							<Icon><EditIcon /></Icon>
						</Button>
						<Button @click="deletePeer(peer.id)" severity="danger">
							<Icon><DeleteIcon /></Icon>
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

const { data: server } = useQuery(queryServer(route.params.id as string));
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

<style>
.table-definition td {
	padding: 0.5rem;
}
</style>
