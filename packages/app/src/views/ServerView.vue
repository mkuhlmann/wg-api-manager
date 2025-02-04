<template>
	<h1 class="text-2xl font-bold mb-4">Server</h1>

	<div class="grid grid-cols-6 gap-5" v-if="server">
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
		</Card>
	</div>

	<h1 class="text-2xl font-bold my-4">Peers</h1>

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
import { useQueries, useQuery } from '@tanstack/vue-query';
import { Button, Card, Dialog } from 'primevue';
import { useRoute, useRouter } from 'vue-router';

import QrCodeIcon from '@vicons/carbon/QrCode';
import CodeIcon from '@vicons/carbon/Code';
import { Icon } from '@vicons/utils';
import { ref } from 'vue';
import { api } from '@app/queries/edenClient';
import QrcodeVue from 'qrcode.vue';

const route = useRoute();

const { data: server } = useQuery(queryServer(route.params.id as string));
const { data: peers } = useQuery(queryServerPeers(route.params.id as string));

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
</script>

<style>
.table-definition td {
	padding: 0.5rem;
}
</style>
