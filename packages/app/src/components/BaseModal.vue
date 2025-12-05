<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition duration-200 ease-out"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition duration-150 ease-in"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="visible"
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
				@click="closeOnBackdropClick"
			>
				<div
					class="w-full max-w-lg bg-gray-800/50 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden transform transition-all"
					@click.stop
				>
					<!-- Header -->
					<div class="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
						<h3 class="text-lg font-medium text-white">
							{{ header }}
						</h3>
						<button
							@click="close"
							class="text-gray-400 hover:text-white transition-colors focus:outline-none"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Content -->
					<div class="p-6 text-gray-300">
						<slot />
					</div>

					<!-- Footer -->
					<div v-if="$slots.footer" class="px-6 py-4 bg-gray-900/30 border-t border-gray-700/50 flex justify-end gap-2">
						<slot name="footer" />
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
	visible: boolean;
	header?: string;
	closeOnBackdrop?: boolean;
}>(), {
	closeOnBackdrop: true,
});

const emit = defineEmits<{
	(e: 'update:visible', value: boolean): void;
	(e: 'close'): void;
}>();

const close = () => {
	emit('update:visible', false);
	emit('close');
};

const closeOnBackdropClick = () => {
	if (props.closeOnBackdrop) {
		close();
	}
};
</script>
