<template>
	<div class="bg-surface border border-border rounded-sm overflow-hidden hover:border-accent-dim transition-colors duration-200 group">
		<div v-if="$slots.header || title" class="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
			<slot name="header">
				<h3 class="text-sm font-semibold text-text group-hover:text-accent transition-colors truncate">
					<span class="text-accent-dim group-hover:text-accent">&gt;</span> {{ title }}
				</h3>
			</slot>
			<slot name="actions" />
		</div>
		<div class="p-4">
			<slot />
		</div>
		<div v-if="$slots.footer" class="px-4 py-3 bg-surface2 border-t border-border">
			<slot name="footer" />
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	title?: string;
}>();
</script>
