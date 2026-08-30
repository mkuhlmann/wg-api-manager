<template>
	<BaseModal v-model:visible="visible" :header="isEditMode ? 'edit group' : 'add group'">
		<form @submit.prevent="handleSubmit" class="flex flex-col gap-5">
			<div class="field">
				<label for="name" class="mb-1.5 text-sm text-muted block"><span class="text-accent-dim">&gt;</span> name</label>
				<BaseInput id="name" v-model="form.name" class="w-full" placeholder="e.g. office" />
				<small class="text-muted text-xs">lowercase slug, used as the group's identifier. cannot be changed once other groups reference it in a rule</small>
				<span v-if="errors.name" class="text-down text-xs block mt-1">{{ errors.name }}</span>
			</div>
			<div class="field">
				<label for="friendlyName" class="mb-1.5 text-sm text-muted block"><span class="text-accent-dim">&gt;</span> friendly name</label>
				<BaseInput id="friendlyName" v-model="form.friendlyName" class="w-full" placeholder="e.g. Office" />
			</div>
			<div class="field">
				<button type="button" class="flex items-center gap-2 text-sm text-text" @click="form.allowServer = !form.allowServer">
					<span class="text-accent-dim">{{ form.allowServer ? '[x]' : '[ ]' }}</span>
					<span><span class="text-accent-dim">&gt;</span> allow server</span>
				</button>
				<small class="text-muted text-xs block mt-1">members can reach the gateway's own tunnel address (dns, management api)</small>
			</div>
			<div class="field">
				<button type="button" class="flex items-center gap-2 text-sm text-text" @click="form.allowInternet = !form.allowInternet">
					<span class="text-accent-dim">{{ form.allowInternet ? '[x]' : '[ ]' }}</span>
					<span><span class="text-accent-dim">&gt;</span> allow internet</span>
				</button>
				<small class="text-muted text-xs block mt-1">members can egress to the internet. also requires "enable nat" on the server</small>
			</div>
			<div class="flex justify-end gap-2 mt-2">
				<BaseButton @click="visible = false" variant="ghost" type="button">cancel</BaseButton>
				<BaseButton type="submit" variant="primary">
					{{ isEditMode ? 'save changes' : 'add group' }}
				</BaseButton>
			</div>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useToast } from '@app/composables/useToast';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { PeerGroup, ServerPeer } from '@server/db/schema';
import { eden } from '@app/queries/edenClient';
import BaseButton from './BaseButton.vue';
import BaseInput from './BaseInput.vue';
import BaseModal from './BaseModal.vue';

const toast = useToast();

const props = defineProps<{
	group?: PeerGroup;
	server: ServerPeer;
}>();

const isEditMode = ref(props.group ? true : false);

const visible = defineModel<boolean>('visible', { required: true });
const queryClient = useQueryClient();

const form = reactive({
	name: '',
	friendlyName: '',
	allowServer: false,
	allowInternet: false,
});

const errors = reactive({
	name: '',
});

const nameRegex = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const validate = () => {
	errors.name = '';
	if (!nameRegex.test(form.name)) {
		errors.name = 'lowercase letters, numbers and hyphens only, must start/end with a letter or number.';
		return false;
	}
	return true;
};

watch(
	() => props.group,
	(group) => {
		if (group) {
			form.name = group.name;
			form.friendlyName = group.friendlyName ?? '';
			form.allowServer = group.allowServer;
			form.allowInternet = group.allowInternet;
			isEditMode.value = true;
		} else {
			isEditMode.value = false;
			form.name = '';
			form.friendlyName = '';
			form.allowServer = false;
			form.allowInternet = false;
		}
		errors.name = '';
	},
	{ immediate: true }
);

const createGroup = useMutation({
	mutationFn: async (data: typeof form) => {
		const res = await eden.api.v1.wg.servers({ id: props.server.id }).groups.post(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['serverGroups', props.server.id] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to create group',
			life: 5000,
		});
	},
});

const updateGroup = useMutation({
	mutationFn: async (data: typeof form) => {
		if (!props.group) return;
		const res = await eden.api.v1.wg.servers({ id: props.server.id }).groups({ groupId: props.group.id }).patch(data);
		return res.data;
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['serverGroups', props.server.id] });
		visible.value = false;
	},
	onError: (error) => {
		toast.add({
			severity: 'error',
			detail: error.message,
			summary: 'Failed to update group',
			life: 5000,
		});
	},
});

const handleSubmit = () => {
	if (!validate()) {
		return;
	}
	if (isEditMode.value) {
		updateGroup.mutate(form);
	} else {
		createGroup.mutate(form);
	}
};
</script>
