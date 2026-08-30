<template>
	<div class="flex flex-col gap-8">
		<div class="text-xs text-muted" v-if="isLoading">loading server... <span class="caret"></span></div>

		<!-- Server Details -->
		<div class="flex flex-col gap-4" v-if="server">
			<h1 class="text-lg font-bold text-text"><span class="text-accent-dim">///</span> {{ server.friendlyName ?? server.id }}</h1>

			<PeerModal v-model:visible="showAddPeerModal" :server="server" />
			<PeerModal v-model:visible="showEditPeerModal" :peer="selectedPeer" :server="server" />

			<BaseCard :title="server.friendlyName ?? server.id" class="max-w-2xl">
				<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm text-muted">
					<span>id</span>
					<span class="truncate text-text">{{ server.id }}</span>

					<span>endpoint</span>
					<span class="truncate text-text">{{ server.wgEndpoint }}</span>

					<span>listen port</span>
					<span class="truncate text-text">{{ server.wgListenPort }}</span>

					<span>cidr range</span>
					<span class="truncate text-text">{{ server.cidrRange }}</span>
				</div>
			</BaseCard>
		</div>

		<div class="rule-line"></div>

		<!-- Peers List -->
		<div class="flex flex-col gap-4">
			<div class="flex justify-between items-center flex-wrap gap-3">
				<h2 class="text-base font-bold text-text"><span class="text-accent-dim">///</span> peers</h2>
				<BaseButton @click="showAddPeerModal = true">add peer</BaseButton>
			</div>

			<DataView :items="peers || []" :filter-fields="['id', 'friendlyName', 'wgAddress']" default-layout="grid">
				<template #grid-item="{ item: peer }">
					<BaseCard :title="peer.friendlyName ?? peer.id" class="h-full flex flex-col">
						<div class="flex-1 flex flex-col gap-3">
							<div class="text-xs">
								<span v-if="!peer.peerInfo" class="text-unknown border border-unknown/40 rounded-sm px-1.5 py-0.5">unknown</span>
								<span v-else-if="peer.peerInfo.connected" class="text-up border border-up/40 rounded-sm px-1.5 py-0.5">up</span>
								<span v-else class="text-down border border-down/40 rounded-sm px-1.5 py-0.5">down</span>
							</div>

							<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-muted">
								<span>id</span>
								<span class="truncate text-text">{{ peer.id }}</span>

								<span>address</span>
								<span class="truncate text-text">{{ peer.wgAddress }}</span>

								<template v-if="peer.peerInfo">
									<span>handshake</span>
									<span class="truncate text-text">{{ peer.peerInfo.wgLatestHandshake == 0 ? '-' : new Date(peer.peerInfo.wgLatestHandshake * 1000).toLocaleString() }}</span>

									<span>received</span>
									<span class="truncate text-text">{{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</span>

									<span>transmitted</span>
									<span class="truncate text-text">{{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</span>
								</template>
							</div>
						</div>

						<template #footer>
							<div class="grid grid-cols-2 gap-2">
								<BaseButton @click="showQrCode(peer.id)" variant="secondary" size="sm">qr</BaseButton>
								<BaseButton @click="showConfig(peer.id)" variant="secondary" size="sm">cfg</BaseButton>
								<BaseButton @click="editPeer(peer)" variant="secondary" size="sm">edit</BaseButton>
								<BaseButton @click="deletePeer(peer.id)" variant="danger" size="sm">del</BaseButton>
							</div>
						</template>
					</BaseCard>
				</template>

				<template #table-header>
					<th class="px-4 py-2.5">status</th>
					<th class="px-4 py-2.5">name/id</th>
					<th class="px-4 py-2.5">address</th>
					<th class="px-4 py-2.5">transfer</th>
					<th class="px-4 py-2.5 text-right">actions</th>
				</template>

				<template #table-row="{ item: peer }">
					<td class="px-4 py-3">
						<span v-if="!peer.peerInfo" class="text-unknown" title="Unknown">&#9679;</span>
						<span v-else-if="peer.peerInfo.connected" class="text-up" title="Connected">&#9679;</span>
						<span v-else class="text-down" title="Disconnected">&#9679;</span>
					</td>
					<td class="px-4 py-3 font-medium text-text">
						{{ peer.friendlyName ?? peer.id }}
					</td>
					<td class="px-4 py-3 text-muted">
						{{ peer.wgAddress }}
					</td>
					<td class="px-4 py-3 text-muted text-xs">
						<div v-if="peer.peerInfo">
							<div>&darr; {{ Math.round((peer.peerInfo.wgTransferRx * 100) / 1024) / 100 }} KiB</div>
							<div>&uarr; {{ Math.round((peer.peerInfo.wgTransferTx * 100) / 1024) / 100 }} KiB</div>
						</div>
						<div v-else>-</div>
					</td>
					<td class="px-4 py-3 text-right">
						<div class="flex justify-end gap-2">
							<BaseButton @click="showQrCode(peer.id)" variant="ghost" size="sm">qr</BaseButton>
							<BaseButton @click="showConfig(peer.id)" variant="ghost" size="sm">cfg</BaseButton>
							<BaseButton @click="editPeer(peer)" variant="ghost" size="sm">edit</BaseButton>
							<BaseButton @click="deletePeer(peer.id)" variant="ghost" size="sm" class="text-down!">del</BaseButton>
						</div>
					</td>
				</template>
			</DataView>
		</div>
	</div>

	<BaseModal v-model:visible="modalQrCode" header="qr code">
		<div class="bg-white p-3 rounded-sm flex justify-center">
			<QrcodeVue v-if="modalQrCode" :size="280" :value="wgConfig" />
		</div>
	</BaseModal>

	<BaseModal v-model:visible="modalConfig" header="configuration">
		<div class="bg-bg p-4 rounded-sm border border-border">
			<pre class="font-mono text-xs text-muted overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{{ wgConfig }}</pre>
		</div>
		<template #footer>
			<div class="flex items-center gap-4 w-full justify-end">
				<span class="opacity-0 transition-opacity text-up text-xs" :class="{ 'opacity-100': showCopiedToClipboard }">copied</span>
				<BaseButton @click="copyConfig" variant="primary">copy to clipboard</BaseButton>
			</div>
		</template>
	</BaseModal>
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
