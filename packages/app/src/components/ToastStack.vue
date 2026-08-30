<template>
	<Teleport to="body">
		<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
			<TransitionGroup
				enter-active-class="transition duration-150 ease-out"
				enter-from-class="opacity-0 translate-x-2"
				enter-to-class="opacity-100 translate-x-0"
				leave-active-class="transition duration-150 ease-in"
				leave-from-class="opacity-100"
				leave-to-class="opacity-0"
			>
				<div
					v-for="m in messages"
					:key="m.id"
					class="border rounded-sm px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
					:class="severityClasses[m.severity]"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="font-semibold flex items-center gap-2">
								<span>{{ severityTag[m.severity] }}</span>
								<span class="truncate">{{ m.summary }}</span>
							</div>
							<div v-if="m.detail" class="text-xs mt-1 opacity-80 break-words">{{ m.detail }}</div>
						</div>
						<button @click="remove(m.id)" class="shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">[x]</button>
					</div>
				</div>
			</TransitionGroup>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@app/composables/useToast';

const { messages, remove } = useToast();

const severityTag = {
	error: '[err]',
	success: '[ok]',
	info: '[i]',
};

const severityClasses = {
	error: 'bg-surface2 border-down text-down',
	success: 'bg-surface2 border-accent-dim text-accent',
	info: 'bg-surface2 border-border text-text',
};
</script>
