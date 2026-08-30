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
			<div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click="closeOnBackdropClick">
				<div class="w-full max-w-lg bg-surface2 border border-border rounded-sm shadow-2xl overflow-hidden" @click.stop>
					<!-- Header -->
					<div class="px-5 py-3 border-b border-border flex items-center justify-between">
						<h3 class="text-sm font-semibold text-text uppercase tracking-wide">
							<span class="text-muted">///</span> {{ header }}
						</h3>
						<button @click="close" class="text-muted hover:text-accent transition-colors focus:outline-none text-sm" aria-label="Close">[x]</button>
					</div>

					<!-- Content -->
					<div class="p-5 text-text">
						<slot />
					</div>

					<!-- Footer -->
					<div v-if="$slots.footer" class="px-5 py-3 bg-bg border-t border-border flex justify-end gap-2">
						<slot name="footer" />
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		visible: boolean;
		header?: string;
		closeOnBackdrop?: boolean;
	}>(),
	{
		closeOnBackdrop: true,
	}
);

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
